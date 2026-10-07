# Junq Bullet

Protótipo web de Bullet Heaven / Survivors-like para PC e celular. Sem backend, conta ou banco de dados.

## Rodar

Baixe o ZIP do repositório, extraia e abra `index.html` no navegador. Também pode servir a pasta com `python -m http.server` ou publicar a branch `main` pelo GitHub Pages. O jogo não usa bibliotecas externas.

## Controles

- PC: WASD ou setas para andar, Espaço para a ultimate, P ou Esc para pausar.
- Celular: joystick no canto inferior esquerdo e botão de ultimate no canto inferior direito.
- O personagem ataca automaticamente o inimigo mais próximo.
- Ao subir de nível, escolha uma das três melhorias. Também aparecem baús que abrem depois de três segundos parado perto deles.

## Estado deste protótipo

O personagem Jão usa o sprite sheet original gerado para o projeto em `assets/jao-walk.png`. Inimigos, cenário, projéteis e efeitos são formas desenhadas pelo Canvas para manter a primeira build autocontida e jogável. `ASSET-CREDITS.md` lista pacotes públicos avaliados para substituir ou complementar esses placeholders.
