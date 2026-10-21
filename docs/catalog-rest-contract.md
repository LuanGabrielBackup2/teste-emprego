# Contratos REST de catálogo e NFT

Esta etapa usa o cliente e o service worker já existentes. A UI futura chamará estes recursos por Axios; os testes de contrato passam pelo navegador e são interceptados no nível de rede pelo MSW.

## `GET /api/nfts`

Parâmetros opcionais:

| Parâmetro | Tipo | Regra |
| --- | --- | --- |
| `q` | texto | Busca sem distinção de maiúsculas em nome, coleção e criador |
| `category` | `avatar`, `art`, `collectible` | Filtro combinável |
| `collection` | texto | Nome exato da coleção |
| `network` | `ethereum`, `polygon` | Filtro combinável |
| `minPriceBRL`, `maxPriceBRL` | decimal em string (reais) | Inclusivos, até duas casas; comparação exata em centavos |
| `sort` | `featured`, `price-asc`, `price-desc`, `newest` | Padrão: `featured` |
| `page` | inteiro | Começa em 1; padrão: 1 |
| `pageSize` | inteiro | 1–50; padrão: 9 |

Resposta 200: `{ "items": Nft[], "pagination": { "page": number, "pageSize": number, "total": number, "totalPages": number } }`. Uma consulta sem correspondências é sucesso com `items: []` e `totalPages: 0`.

## `GET /api/nfts/:nftId`

Resposta 200: `{ "item": Nft }`. ID desconhecido retorna 404. Consultas inválidas retornam 400. Erros compartilham a forma `{ "error": { "code": string, "message": string } }`.

`Nft` é definido em `src/contracts/nft.ts`. `priceBRL` é string decimal em reais (por exemplo, `"235.90"`), disponibilidade é inteira, e `version` é a versão estável usada posteriormente na reconciliação de eventos. Os valores das fixtures foram definidos como preços simulados em BRL; nenhuma conversão cambial é feita. As 18 fixtures fixas exercitam coleções, redes, categorias, preços e edições disponíveis/esgotadas; futuras atualizações deverão alterar a mesma fonte que os handlers REST e Socket.IO usam.
