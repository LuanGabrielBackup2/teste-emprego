# Contratos REST do carrinho

Todos os preços são simulados originalmente em BRL e trafegam como strings decimais com duas casas. A UI formata os valores para `pt-BR`; regras e subtotais usam inteiros em centavos.

## `GET /api/cart`

Retorna `{ "items": CartLine[], "quote": CartQuote }`. Cada linha contém o NFT atual, quantidade e `lineSubtotalBRL`. A cotação inclui `subtotalBRL`, `discountBRL`, `networkFeeBRL`, `totalBRL`, `couponCode` opcional e `itemCount`.

## Mutations

- `POST /api/cart/items` recebe `{ "nftId": string, "quantity": integer }`. Uma adição à linha existente soma quantidades. Quantidade além da edição disponível retorna `409 EDITION_UNAVAILABLE`.
- `PATCH /api/cart/items/:nftId` recebe a quantidade desejada e aplica o mesmo limite.
- `DELETE /api/cart/items/:nftId` remove uma linha; `DELETE /api/cart` limpa linhas e cupom.
- `POST /api/cart/coupon` recebe `{ "code": string }`. `JUNGLE10` aplica 10%; `VERDE5` retorna `422 COUPON_EXPIRED`; outros códigos retornam `422 INVALID_COUPON`.
- `DELETE /api/cart/coupon` remove o cupom.

O armazenamento mock persiste apenas identificadores, quantidades e cupom na chave local `jungle-market.cart.v1`. Cada GET recompõe as linhas com as fixtures atuais e recalcula a cotação, evitando persistir totais obsoletos. O reset do cenário de teste remove essa chave.

Nesta simulação, a taxa de rede retornada pela API é `"0.00"`: não existe cobrança de frete para bens digitais e nenhuma taxa fictícia é adicionada. A futura etapa de checkout deverá revalidar preço, disponibilidade e cotação antes de criar o pedido.

O cliente atualiza quantidades e remoções de forma otimista no cache do TanStack Query e restaura a cotação anterior caso o servidor simulado rejeite a mutation. Eventos `nft.updated` acionam uma nova leitura REST do carrinho; o evento é aceito apenas se sua versão for mais recente que a já processada para aquele NFT.

## Cenários determinísticos do mock

- `POST /api/mock/scenarios/nfts/:nftId` recebe `priceBRL` e/ou `available`, altera a fixture ativa e emite `nft.updated` via Socket.IO a todos os clientes conectados.
- `POST /api/mock/scenarios/reset` restaura todas as fixtures aos dados iniciais.
- Para falha REST transitória de leitura, definir `localStorage['jungle-market.scenario.cart-read-failure'] = 'once'`; o próximo `GET /api/cart` retorna 503 e consome o cenário.
- Para validar rollback otimista, definir `localStorage['jungle-market.scenario.cart-update-failure'] = 'once'`; o próximo `PATCH /api/cart/items/:nftId` retorna 503.
