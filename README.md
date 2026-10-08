# Junq Bullet

Protótipo web de Bullet Heaven / Survivors-like para PC e celular. Sem backend, conta ou banco de dados.

## Rodar

Baixe o ZIP do repositório, extraia e abra `index.html` no navegador. Também pode servir a pasta com `python -m http.server` ou publicar a branch `main` pelo GitHub Pages. O jogo não usa bibliotecas externas.

## Controles

- PC: WASD ou setas para andar, Espaço para a ultimate, P ou Esc para pausar.
- Celular: joystick no canto inferior esquerdo e botão de ultimate no canto inferior direito.
- O personagem ataca automaticamente o inimigo mais próximo.
- Gui dispara três cartas em cone; a ultimate Mão de Trunfo lança um leque maior, perfura e atordoa os inimigos atingidos.
- Ao subir de nível, escolha uma das três melhorias. Também aparecem baús que abrem depois de três segundos parado perto deles.

## Estado deste protótipo

Jão, Alice e Gui usam sprite sheets locais com quatro direções. Os inimigos usam as concepts aprovadas em `assets/enemy-*.png` (gosma, pombo-morcego, cães das sombras, baratas e Rei do Poste); cenário, projéteis e efeitos são desenhados em Canvas. `ASSET-CREDITS.md` lista as artes do projeto e pacotes públicos avaliados.
