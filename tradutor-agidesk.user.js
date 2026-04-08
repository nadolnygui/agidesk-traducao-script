// ==UserScript==
// @name         Tradutor Agidesk
// @match        *://pxenergy.agidesk.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('Script ativo 🚀');

    function inserirBotao() {
        const form = document.querySelector('#formanswercontact-frontend-creation-form');
        if (!form) return;

        if (form.querySelector('#btn-traduzir')) return;

        const campoBase = document.querySelector('#forms-answers-steps-199-form-field-1319');
        if (!campoBase) return;

        const btn = document.createElement('button');
        btn.id = 'btn-traduzir';
        btn.innerText = '⚡ Traduzir Tudo';
        btn.type = 'button';
        btn.className = 'ui button primary small';
        btn.style.marginTop = '10px';
        btn.style.width = '100%';

        // 🔹 função de tradução com fallback
        async function traduzir(texto) {
            try {
                const res = await fetch(
                    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=en&dt=t&q=${encodeURIComponent(texto)}`
                );

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();
                return data[0].map(item => item[0]).join('');
            } catch (e) {
                console.error('Falha no endpoint de tradução:', e);
                // Retorna o texto original se houver algum erro
                return texto;
            }
        }

        async function traduzirCampo(namePT, nameEN, flag) {
            const campoPT = document.querySelector(`[name="${namePT}"]`);
            const campoEN = document.querySelector(`[name="${nameEN}"]`);
            if (!campoPT || !campoEN) return;

            if (campoPT.value.trim() === "") return;

            const traducao = await traduzir(campoPT.value);
            campoEN.value = traducao;
            campoEN.dispatchEvent(new Event('input', { bubbles: true }));
            flag.traduziuAlgo = true;
        }

        async function traduzirEditores(flag) {
            const editores = document.querySelectorAll('.note-editable');
            const total = editores.length;
            const metade = total / 2;

            if (total % 2 !== 0) console.warn('Quantidade de editores ímpar, pode dar erro');

            for (let i = 0; i < metade; i++) {
                const pt = editores[i];
                const en = editores[i + metade];

                if (!pt || !en) continue;

                const texto = pt.innerText.trim();
                if (!texto || texto === "<p><br></p>") continue;

                const traducao = await traduzir(texto);
                en.innerHTML = `<p>${traducao}</p>`;
                en.dispatchEvent(new Event('input', { bubbles: true }));
                en.dispatchEvent(new Event('keyup', { bubbles: true }));

                const placeholder = en.parentElement.querySelector('.note-placeholder');
                if (placeholder) placeholder.style.display = 'none';

                flag.traduziuAlgo = true;
            }
        }

        btn.onclick = async () => {
            console.log('Traduzindo tudo...');
            const flag = { traduziuAlgo: false };

            await traduzirCampo('1304', '1316', flag); // assunto
            await traduzirEditores(flag); // editores ricos

            if (flag.traduziuAlgo) {
                alert('Tudo traduzido 🚀');
            } else {
                alert('Nada para traduzir ⚠️');
            }
        };

        campoBase.appendChild(btn);
    }

    setInterval(inserirBotao, 700);

})();
