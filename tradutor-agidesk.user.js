// ==UserScript==
// @name         Tradutor Agidesk
// @match        *://pxenergy.agidesk.com/*
// @grant        none
// @version      1.5
// @updateURL    https://raw.githubusercontent.com/nadolnygui/agidesk-traducao-script/main/tradutor-agidesk.user.js
// @downloadURL  https://raw.githubusercontent.com/nadolnygui/agidesk-traducao-script/main/tradutor-agidesk.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const FORM_SELECTOR = '#forms-answers-steps-199-form';
    const BUTTON_ID = 'btn-traduzir';
    const ROW_ID = 'linha-subject-tradutor';

    const TIPTAP_SELECTOR =
        '.tiptap.ProseMirror.tiptap-content[contenteditable="true"]';

    const SUMMERNOTE_SELECTOR = '.note-editable';

    function estaVisivel(elemento) {
        if (!elemento) return false;

        const estilo = getComputedStyle(elemento);
        const caixa = elemento.getBoundingClientRect();

        return (
            estilo.display !== 'none' &&
            estilo.visibility !== 'hidden' &&
            caixa.width > 0 &&
            caixa.height > 0
        );
    }

    function encontrarTituloCriarERFD() {
        return [...document.querySelectorAll('h4')]
            .find(elemento =>
                estaVisivel(elemento) &&
                elemento.textContent.trim() === 'Criar ERFD'
            );
    }

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
        const campoPT =
            form.querySelector(`[name="${namePT}"]`);

        const campoEN =
            form.querySelector(`[name="${nameEN}"]`);

        if (!campoPT || !campoEN) {
            return;
        }

        const textoPT = campoPT.value.trim();

        if (!textoPT) {
            return;
        }

        const traducao =
            await traduzir(textoPT);

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
            const editores =
                container.querySelectorAll(
                    TIPTAP_SELECTOR
                );

            const textareas =
                container.querySelectorAll(
                    'textarea'
                );

            if (
                editores.length === 1 &&
                textareas.length === 1
            ) {
                return textareas[0];
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
                'Quantidade ímpar de editores. ' +
                'A tradução foi interrompida.'
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
                const encontrado =
                    encontrarTextareaDoEditor(editor);

                if (encontrado) {
                    return encontrado;
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

            if (
                !editorPT.innerText.trim() &&
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

        if (
            editores.length === 0 ||
            editores.length % 2 !== 0
        ) {
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

    function removerBotaoEReverterLinha() {
        document
            .querySelector(`#${BUTTON_ID}`)
            ?.remove();

        const linha =
            document.querySelector(`#${ROW_ID}`);

        if (!linha) {
            return;
        }

        const subject =
            linha.querySelector('[name="1316"]');

        if (
            subject &&
            linha.parentElement
        ) {
            linha.parentElement.insertBefore(
                subject,
                linha
            );
        }

        linha.remove();
    }

    function posicionarBotao(
        form,
        subject,
        botao
    ) {
        let linha =
            form.querySelector(`#${ROW_ID}`);

        if (!linha) {
            linha =
                document.createElement('div');

            linha.id = ROW_ID;

            subject.parentElement.insertBefore(
                linha,
                subject
            );

            linha.appendChild(subject);
        }

        linha.appendChild(botao);

        linha.style.setProperty(
            'display',
            'flex',
            'important'
        );

        linha.style.setProperty(
            'align-items',
            'center',
            'important'
        );

        linha.style.setProperty(
            'gap',
            '16px',
            'important'
        );

        linha.style.setProperty(
            'width',
            '100%',
            'important'
        );

        subject.style.setProperty(
            'width',
            'auto',
            'important'
        );

        subject.style.setProperty(
            'flex',
            '1 1 0',
            'important'
        );

        subject.style.setProperty(
            'min-width',
            '0',
            'important'
        );

        botao.style.setProperty(
            'margin',
            '0',
            'important'
        );

        botao.style.setProperty(
            'width',
            'auto',
            'important'
        );

        botao.style.setProperty(
            'min-width',
            '150px',
            'important'
        );

        botao.style.setProperty(
            'padding-left',
            '22px',
            'important'
        );

        botao.style.setProperty(
            'padding-right',
            '22px',
            'important'
        );

        botao.style.setProperty(
            'height',
            '38px',
            'important'
        );

        botao.style.setProperty(
            'white-space',
            'nowrap',
            'important'
        );

        botao.style.setProperty(
            'flex',
            '0 0 auto',
            'important'
        );
    }

    function inserirBotao() {
        const form =
            document.querySelector(
                FORM_SELECTOR
            );

        const tituloCriarERFD =
            encontrarTituloCriarERFD();

        const subject =
            form?.querySelector(
                '[name="1316"]'
            );

        /*
         * O botão só aparece quando:
         * 1. O formulário ERFD está aberto;
         * 2. O título visível é "Criar ERFD";
         * 3. O campo Subject está visível.
         */
        if (
            !form ||
            !tituloCriarERFD ||
            !subject ||
            !estaVisivel(subject)
        ) {
            removerBotaoEReverterLinha();
            return;
        }

        if (
            form.querySelector(
                `#${BUTTON_ID}`
            )
        ) {
            return;
        }

        const botao =
            document.createElement('button');

        botao.id = BUTTON_ID;
        botao.type = 'button';
        botao.textContent =
            '⚡ Traduzir Tudo';

        botao.className =
            'ui button primary small';

        botao.addEventListener(
            'click',
            async () => {
                const textoOriginal =
                    botao.textContent;

                botao.disabled = true;
                botao.textContent =
                    '⏳ Traduzindo...';

                try {
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
                        'Erro no Tradutor Agidesk:',
                        erro
                    );

                    alert(
                        'Ocorreu um erro ao traduzir.'
                    );

                } finally {
                    botao.disabled = false;
                    botao.textContent =
                        textoOriginal;
                }
            }
        );

        posicionarBotao(
            form,
            subject,
            botao
        );
    }

    inserirBotao();

    setInterval(
        inserirBotao,
        700
    );
})();
