# Dados da TACO

`food.csv` e `nutrients.csv` vêm de https://github.com/raulfdm/taco-api (pasta `references/csv`), que
digitaliza a **Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição — NEPA/Unicamp**.
Valores por 100 g de parte comestível. Campo vazio = não analisado / não aplicável. No app: vitamina A vazia vira 0 (traços); fibra e vit. C vazias viram 0 só em carnes, pescados, leite, óleos, bebidas e açúcares; nos demais ficam "sem dado" e a tela avisa.

A TACO **não traz** vitamina D, vitamina B12 nem folato: esses três ficam `null` no app e a tela avisa.

Para regenerar `public/taco.json`: `node scripts/gerar-taco.mjs`
