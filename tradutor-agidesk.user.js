// ==UserScript==
// @name         Tradutor Agidesk
// @match        *://pxenergy.agidesk.com/*
// @grant        none
// @version      1.4
// @updateURL    https://raw.githubusercontent.com/nadolnygui/agidesk-traducao-script/main/tradutor-agidesk.user.js
// @downloadURL  https://raw.githubusercontent.com/nadolnygui/agidesk-traducao-script/main/tradutor-agidesk.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const FORM_SELECTOR =
        '#formanswercontact-frontend-creation-form';

    const BUTTON_ID =
        'btn-traduzir';

    const TIPTAP_SELECTOR =
        '.tiptap.ProseMirror.tiptap-content[contenteditable="true"]';

    const SUMMERNOTE_SELECTOR =
        '.note-editable';

    async function traduzir(texto) {
        try {
            const resposta = await fetch(
                'https://translate.googleapis.com/translate_a/single' +
                '?client=gtx' +
                '&sl=pt' +
                '&tl=en' +
                '&dt=t' +
                `&q=${encodeURIComponent(texto)}`
            );

            if (!resposta.ok) {
                throw new Error(`HTTP ${resposta.status}`);
            }

            const dados = await resposta.json();

            if (!Array.isArray(dados?.[0])) {
                throw new Error(
                    'Resposta inesperada da API de tradução.'
                );
            }

            return dados[0]
                .map(item => item?.[0] || '')
                .join('');

        } catch (erro) {
            console.error(
                'Falha no endpoint de tradução:',
                erro
            );

            return texto;
        }
    }

    function definirValorNativo(campo, valor) {
        const prototipo =
            campo instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;

        const setter =
            Object.getOwnPropertyDescriptor(
                prototipo,
                'value'
            )?.set;

        if (setter) {
            setter.call(campo, valor);
        } else {
            campo.value = valor;
        }
    }

    function dispararEventosCampo(campo) {
        campo.dispatchEvent(
            new Event('input', {
                bubbles: true,
                composed: true
            })
        );

        campo.dispatchEvent(
            new Event('change', {
                bubbles: true,
                composed: true
            })
        );
    }

    async function traduzirCampo(
        form,
        namePT,
        nameEN,
        flag
    ) {
        const campoPT = form.querySelector(
            `[name="${namePT}"]`
        );

        const campoEN = form.querySelector(
            `[name="${nameEN}"]`
        );

        if (!campoPT || !campoEN) {
            return;
        }

        const textoPT = campoPT.value.trim();

        if (!textoPT) {
            return;
        }

        const traducao = await traduzir(textoPT);

        definirValorNativo(
            campoEN,
            traducao
        );

        dispararEventosCampo(campoEN);

        flag.traduziuAlgo = true;
    }

    async function traduzirHTML(html) {
        const container =
            document.createElement('div');

        container.innerHTML = html;

        const walker =
            document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT
            );

        const textos = [];

        let node;

        while ((node = walker.nextNode())) {
            const original =
                node.nodeValue || '';

            if (!original.trim()) {
                continue;
            }

            textos.push({
                node,
                texto: original.trim(),

                inicioEspaco:
                    original.match(/^\s*/)?.[0] || '',

                fimEspaco:
                    original.match(/\s*$/)?.[0] || ''
            });
        }

        for (const item of textos) {
            const traducao =
                await traduzir(item.texto);

            item.node.nodeValue =
                item.inicioEspaco +
                traducao +
                item.fimEspaco;
        }

        return container.innerHTML;
    }

    function encontrarTextareaDoEditor(editor) {
        let container =
            editor.parentElement;

        for (
            let nivel = 0;
            nivel < 6 && container;
            nivel++
        ) {
            const editoresNoContainer =
                container.querySelectorAll(
                    TIPTAP_SELECTOR
                );

            const textareasNoContainer =
                container.querySelectorAll(
                    'textarea'
                );

            if (
                editoresNoContainer.length === 1 &&
                textareasNoContainer.length === 1
            ) {
                return textareasNoContainer[0];
            }

            container =
                container.parentElement;
        }

        return null;
    }

    function atualizarEditorTipTap(
        editor,
        textarea,
        html
    ) {
        editor.focus();

        editor.innerHTML = html;

        editor.dispatchEvent(
            new InputEvent('input', {
                bubbles: true,
                composed: true,
                inputType: 'insertFromPaste',
                data: editor.innerText
            })
        );

        editor.dispatchEvent(
            new Event('change', {
                bubbles: true,
                composed: true
            })
        );

        editor.dispatchEvent(
            new KeyboardEvent('keyup', {
                bubbles: true,
                composed: true,
                key: 'Unidentified'
            })
        );

        if (textarea) {
            definirValorNativo(
                textarea,
                html
            );

            dispararEventosCampo(
                textarea
            );
        }

        editor.blur();
    }

    async function traduzirEditoresTipTap(
        form,
        flag
    ) {
        const editores = [
            ...form.querySelectorAll(
                TIPTAP_SELECTOR
            )
        ];

        if (editores.length === 0) {
            return false;
        }

        console.log(
            `Editores TipTap encontrados: ${editores.length}`
        );

        if (editores.length % 2 !== 0) {
            console.warn(
                'Quantidade ímpar de editores TipTap. ' +
                'A tradução foi interrompida para evitar ' +
                'preencher campos errados.'
            );

            return true;
        }

        const metade =
            editores.length / 2;

        const todosTextareas = [
            ...form.querySelectorAll('textarea')
        ];

        const textareas =
            editores.map((editor, indice) => {
                const textareaEncontrado =
                    encontrarTextareaDoEditor(editor);

                if (textareaEncontrado) {
                    return textareaEncontrado;
                }

                if (
                    todosTextareas.length ===
                    editores.length
                ) {
                    return todosTextareas[indice];
                }

                return null;
            });

        for (
            let i = 0;
            i < metade;
            i++
        ) {
            const editorPT =
                editores[i];

            const editorEN =
                editores[i + metade];

            const textareaPT =
                textareas[i];

            const textareaEN =
                textareas[i + metade];

            if (!editorPT || !editorEN) {
                continue;
            }

            const htmlPT =
                textareaPT?.value?.trim()
                    ? textareaPT.value
                    : editorPT.innerHTML;

            const textoPT =
                editorPT.innerText.trim();

            if (
                !textoPT &&
                !textareaPT?.value?.trim()
            ) {
                continue;
            }

            const htmlTraduzido =
                await traduzirHTML(htmlPT);

            atualizarEditorTipTap(
                editorEN,
                textareaEN,
                htmlTraduzido
            );

            flag.traduziuAlgo = true;
        }

        return true;
    }

    async function traduzirEditoresSummernote(
        form,
        flag
    ) {
        const editores = [
            ...form.querySelectorAll(
                SUMMERNOTE_SELECTOR
            )
        ];

        if (editores.length === 0) {
            return;
        }

        if (editores.length % 2 !== 0) {
            console.warn(
                'Quantidade ímpar de editores Summernote. ' +
                'A tradução foi interrompida para evitar ' +
                'preencher campos errados.'
            );

            return;
        }

        const metade =
            editores.length / 2;

        for (
            let i = 0;
            i < metade;
            i++
        ) {
            const editorPT =
                editores[i];

            const editorEN =
                editores[i + metade];

            if (
                !editorPT ||
                !editorEN ||
                !editorPT.innerText.trim()
            ) {
                continue;
            }

            editorEN.innerHTML =
                await traduzirHTML(
                    editorPT.innerHTML
                );

            editorEN.dispatchEvent(
                new Event('input', {
                    bubbles: true
                })
            );

            editorEN.dispatchEvent(
                new Event('keyup', {
                    bubbles: true
                })
            );

            const placeholder =
                editorEN.parentElement
                    ?.querySelector(
                        '.note-placeholder'
                    );

            if (placeholder) {
                placeholder.style.display =
                    'none';
            }

            flag.traduziuAlgo = true;
        }
    }

    async function traduzirEditores(
        form,
        flag
    ) {
        const encontrouTipTap =
            await traduzirEditoresTipTap(
                form,
                flag
            );

        if (!encontrouTipTap) {
            await traduzirEditoresSummernote(
                form,
                flag
            );
        }
    }

function encontrarLocalDoBotao(form) {
    const subject = form.querySelector('[name="1316"]');

    if (!subject || !subject.parentElement) {
        return form;
    }

    const container = subject.parentElement;

    /*
     * Primeira linha: label ocupando toda a largura.
     * Segunda linha: Subject à esquerda e botão à direita.
     */
    container.style.display = 'grid';
    container.style.gridTemplateColumns =
        'minmax(0, 1fr) auto';
    container.style.columnGap = '10px';
    container.style.rowGap = '6px';
    container.style.alignItems = 'end';

    /*
     * Faz o label continuar ocupando a linha inteira.
     */
    [...container.children].forEach(elemento => {
        if (elemento !== subject) {
            elemento.style.gridColumn = '1 / -1';
        }
    });

    subject.style.gridColumn = '1';
    subject.style.minWidth = '0';
    subject.style.setProperty(
        'width',
        '100%',
        'important'
    );

    return container;
}

    function inserirBotao() {
        const form =
            document.querySelector(
                FORM_SELECTOR
            );

        if (!form) {
            return;
        }

        if (
            form.querySelector(
                `#${BUTTON_ID}`
            )
        ) {
            return;
        }

        const campoBase =
            encontrarLocalDoBotao(form);

        if (!campoBase) {
            return;
        }

        const botao =
            document.createElement('button');

        botao.id =
            BUTTON_ID;

        botao.innerText =
            '⚡ Traduzir Tudo';

        botao.type =
            'button';

        botao.className =
            'ui button primary small';

        botao.style.marginTop =
            '0';

        botao.style.width =
            'auto';

        botao.style.whiteSpace =
            'nowrap';

        botao.style.gridColumn =
            '2';

        botao.style.alignSelf =
            'end';

        botao.style.height =
            '38px';

        botao.addEventListener(
            'click',
            async () => {
                const textoOriginal =
                    botao.innerText;

                botao.disabled = true;

                botao.innerText =
                    '⏳ Traduzindo...';

                try {
                    console.log(
                        'Traduzindo tudo...'
                    );

                    const flag = {
                        traduziuAlgo: false
                    };

                    await traduzirCampo(
                        form,
                        '1304',
                        '1316',
                        flag
                    );

                    await traduzirEditores(
                        form,
                        flag
                    );

                    if (flag.traduziuAlgo) {
                        alert(
                            'Tudo traduzido 🚀'
                        );
                    } else {
                        alert(
                            'Nada para traduzir ⚠️'
                        );
                    }

                } catch (erro) {
                    console.error(
                        'Erro inesperado no Tradutor Agidesk:',
                        erro
                    );

                    alert(
                        'Ocorreu um erro ao traduzir. ' +
                        'Consulte o Console.'
                    );

                } finally {
                    botao.disabled = false;

                    botao.innerText =
                        textoOriginal;
                }
            }
        );

        campoBase.appendChild(botao);
    }

    inserirBotao();

    setInterval(
        inserirBotao,
        700
    );
})();
