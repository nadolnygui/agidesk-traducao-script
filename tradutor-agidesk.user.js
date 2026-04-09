// ==UserScript==
// @name         Tradutor Agidesk
// @match        *://pxenergy.agidesk.com/*
// @grant        none
// @version      1.2
// @updateURL    https://raw.githubusercontent.com/nadolnygui/agidesk-traducao-script/main/tradutor-agidesk.user.js
// @downloadURL  https://raw.githubusercontent.com/nadolnygui/agidesk-traducao-script/main/tradutor-agidesk.user.js
// ==/UserScript==

(function() {
    'use strict';

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

            for (let i = 0; i < metade; i++) {
                const pt = editores[i];
                const en = editores[i + metade];

                if (!pt || !en) continue;

                const clone = pt.cloneNode(true);

                const walker = document.createTreeWalker(
                    clone,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let node;
                const textos = [];

                while (node = walker.nextNode()) {
                    const original = node.nodeValue;

                    if (!original.trim()) continue;

                    const inicioEspaco = original.match(/^\s*/)[0];
                    const fimEspaco = original.match(/\s*$/)[0];
                    const textoLimpo = original.trim();

                    textos.push({
                        node,
                        texto: textoLimpo,
                        inicioEspaco,
                        fimEspaco
                    });
               }

        for (let item of textos) {
            const traducao = await traduzir(item.texto);

            item.node.nodeValue =
                item.inicioEspaco +
                traducao +
                item.fimEspaco;
        }

        en.innerHTML = clone.innerHTML;

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

            await traduzirCampo('1304', '1316', flag); 
            await traduzirEditores(flag); 

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
