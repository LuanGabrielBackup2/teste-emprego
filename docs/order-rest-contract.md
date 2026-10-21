# Contratos REST de checkout e pedidos simulados

Todos os endpoints abaixo passam pelo Axios e são atendidos pelo MSW. Os valores monetários trafegam em BRL como strings decimais; o domínio calcula em centavos inteiros. Nenhuma operação cobra dinheiro ou acessa uma blockchain.

## Cotação e carteiras

- `GET /api/checkout/quote` — exige sessão; devolve itens atuais, quantidades, disponibilidade, preço unitário, subtotal, cupom, desconto, taxa (R$ 0,00 nesta simulação), total e `version`.
- `GET /api/wallets` — exige sessão; devolve as carteiras fictícias do usuário.
- `POST /api/wallets/:walletId/connect` e `POST /api/wallets/:walletId/disconnect` — confirmam apenas o estado simulado da interface.

O `version` da cotação considera produtos, preços, estoque, quantidades, cupom e totais. O `POST /api/orders` recalcula esses dados no servidor simulado. Cotação divergente retorna `409 QUOTE_CHANGED` e a cotação atual, que precisa ser revisada antes de outro envio. Estoque insuficiente retorna `409 EDITION_UNAVAILABLE`.

## Pedidos

`POST /api/orders` recebe `Idempotency-Key` e um corpo com `quoteVersion`, `buyer` (nome, e-mail, CPF), `walletId` e `network`. A API valida sessão, CPF, carteira/rede, preço, disponibilidade e cotação. A criação responde `201 { order }`, inicialmente pendente.

Pedidos são isolados em armazenamento local por `userId`. A chave e a impressão do conteúdo aceito ficam registradas com o pedido: repetir a chave e o mesmo corpo devolve o mesmo pedido; repetir a chave com corpo diferente devolve `409 IDEMPOTENCY_CONFLICT`.

- `GET /api/orders/:orderId` — consulta o pedido e o snapshot somente para o usuário proprietário.
- `GET /api/orders/by-idempotency/:key` — recupera uma tentativa mesmo se a resposta original se perdeu.

O snapshot contém nome/arte/coleção, quantidade, preço unitário, subtotal, cupom, desconto, taxa, total, colecionador e carteira/rede. Ele não depende do catálogo depois da criação. Na confirmação simulada, a referência `SIM-…` é gerada, as quantidades compradas são removidas do carrinho e a disponibilidade é atualizada. Pedidos recusados preservam o carrinho.

## Estados e eventos

Estados: `pending`, `confirmed` e `declined`. Somente `confirmed` libera o recibo. `order.updated` contém `orderId`, `userId`, `version` e `status`. O cliente ignora usuário/recurso diferentes e versões antigas/duplicadas; o evento invalida a consulta REST, que continua autoritativa. A tela pendente consulta a API periodicamente e também reconcilia ao reconectar.

## Cenários determinísticos de demonstração

As rotas de cenário são utilitários locais de demonstração/teste:

- `POST /api/mock/scenarios/orders` com `{ "outcome": "confirmed" | "declined" | "pending" }` escolhe o resultado da próxima criação.
- `{ "timeoutOnce": true }` persiste o pedido e perde a resposta uma vez; recuperação pela chave devolve a mesma criação.
- `{ "unavailableOnce": true }` devolve `503` antes de criar.
- `{ "walletRefused": true }` recusa a próxima conexão simulada.
- `POST /api/mock/scenarios/orders/:id/resolve` com `{ "status": "confirmed" | "declined" }` resolve um pedido pendente para ensaios de interrupção.
- `POST /api/mock/scenarios/nfts/:id` altera preço/estoque e emite `nft.updated` pelo Socket.IO.

Esses cenários não são integrações externas nem uma promessa de pagamento real.
