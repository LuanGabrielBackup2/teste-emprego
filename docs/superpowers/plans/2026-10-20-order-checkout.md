# Plano de implementação — checkout e pedidos

## Escopo

Implementar o Marco 5 do marketplace. Todas as compras permanecem simuladas e os preços são BRL. A API simulada é a autoridade para cotação, disponibilidade, criação e estado dos pedidos. O README original continua como referência para os demais requisitos do projeto.

## Etapas curtas

1. **Contratos e transporte:** tipos de cotação/pedido/carteira, validação de negócio, endpoints de cotação, carteiras, criação idempotente e consulta. Critério: snapshot consistente em centavos, isolamento por usuário, conflito de preço/estoque e idempotência com conflito para payload divergente.
2. **Interface de checkout:** substituir o placeholder por revisão acessível do carrinho, dados do colecionador e carteira/rede fictícias. Critério: validação de campos, conexão simulada, envio bloqueado em cotação obsoleta, falhas preservam carrinho e clique repetido não duplica pedidos.
3. **Ciclo do pedido:** rota de resultado, recuperação via REST, eventos `order.updated` versionados e reconciliação. Critério: telas separadas para pendente/confirmado/recusado; recibo somente após confirmação da API.
4. **Regressão e cenários:** Playwright para compra, idempotência, timeout, erro, preço/estoque, estados terminais e recuperação; typecheck/build e regressão anterior.

## Arquivos previstos

Criar `src/contracts/order.ts`, `src/domain/checkout.ts`, `src/features/checkout/checkout-api.ts`, `src/features/checkout/checkout-page.tsx`, `src/features/checkout/checkout.css`, `src/features/orders/order-page.tsx`, `docs/order-rest-contract.md`, `tests/e2e/checkout.spec.ts` e `tests/e2e/orders.spec.ts`.

Modificar `src/mocks/handlers.ts`, `src/contracts/realtime.ts`, `src/lib/realtime/socket.ts`, `src/app/router.tsx` e `src/features/auth/auth-pages.tsx` apenas para substituir o placeholder de checkout. Preservar `README.md`, `.vscode`, contratos existentes e testes anteriores.

## Decisões

- Valores monetários permanecem strings decimais nos contratos e são calculados com centavos inteiros/`bigint` no domínio.
- A cotação recebe uma versão/fingerprint. Se preço, disponibilidade, itens ou cupom mudarem, a API recusa a cotação antiga e devolve a atual para nova revisão explícita.
- A chave de idempotência fica estável durante uma tentativa e o cliente recupera pedido por chave se a resposta se perder.
- A simulação cria snapshots imutáveis dos dados aceitos. Os estados padrão podem evoluir via evento; os cenários podem forçar pendência, recusa, timeout após persistência e indisponibilidade.
- Carteiras e conexão são fixtures locais. Nenhum provedor, gateway ou blockchain real é integrado.
- Eventos Socket.IO são sugestões versionadas; a interface reconcilia o pedido pela API antes de apresentar seu estado.

## Verificações

Em cada etapa: executar verificações focadas. Ao concluir: `npm run typecheck`, `npm run build` e Playwright Chromium para checkout/pedidos e regressão completa aplicável. Não criar commit.
