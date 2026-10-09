# Junq Bullet

Protótipo web de Bullet Heaven / Survivors-like para PC e celular. Sem backend, conta ou banco de dados.

## Rodar

Baixe o ZIP do repositório, extraia e abra `index.html` no navegador. Também pode servir a pasta com `python -m http.server` ou publicar a branch `main` pelo GitHub Pages. O jogo não usa bibliotecas externas.

## Controles

- PC: WASD ou setas para andar, Espaço para a ultimate, P ou Esc para pausar.
- Celular: joystick configurável na pausa (posição, tamanho e lado), ultimate manual ou automática.
- O personagem ataca automaticamente o inimigo mais próximo.
- Gui dispara três cartas em cone curto, com dano alto de perto e alcance limitado; a ultimate Mão de Trunfo lança um leque maior, perfura e atordoa os inimigos atingidos.
- Jão escolhe um caminho elétrico no nível 16 e uma forma final no 36: rastro que fere e desacelera, choque em cadeia reforçado ou pulso de contragolpe. O casaco urbano evolui visualmente nos dois níveis.
- Ao subir de nível, escolha uma das três melhorias. Também aparecem baús que abrem depois de três segundos parado perto deles.
- O Rei do Poste alterna entre um impacto circular e um raio em linha reta, ambos anunciados com antecedência para dar tempo de esquivar.
- O fim da partida mostra tempo, eliminações, nível, XP, baús, ultimates, melhorias, evoluções e resultado do chefe.

## Estado deste protótipo

Jão, Alice e Gui usam sprite sheets locais com quatro direções. Os inimigos usam as concepts aprovadas em `assets/enemy-*.png` (gosma, pombo-morcego, cães das sombras, baratas e Rei do Poste); cenário, projéteis e efeitos são desenhados em Canvas. `ASSET-CREDITS.md` lista as artes do projeto e pacotes públicos avaliados.
- Alice escolhe uma evolução de esmalte no nível 16 (veneno, lentidão, roubo de vida ou vulnerabilidade) e uma especialização no nível 36. Cada cor agora tem sprite próprio de evolução nos dois níveis; o visual muda junto com o caminho escolhido, sem auras.
- Gui evolui o casaco com detalhes de cartas nos níveis 16 e 36, mantendo suas rotas de habilidade.
- Gui escolhe no nível 16 entre cartas mais fortes de perto, ricochetes ou um Trunfo Premiado; no nível 36, especializa o caminho em uma das três formas finais.
