\# Arquitetura — Jungle Gaming NFT Marketplace



\## 1. Visão geral



Aplicação frontend de marketplace de NFTs desenvolvida com React e TypeScript. A arquitetura organiza a interface por funcionalidades, separa contratos e regras de domínio da apresentação e centraliza as comunicações HTTP e em tempo real.



O ambiente de demonstração utiliza MSW para interceptar requisições e disponibilizar respostas simuladas. Não há integração com pagamentos reais ou transações reais de blockchain.



\## 2. Tecnologias



\- React e React DOM: interface e renderização.

\- TypeScript: tipagem estática.

\- Vite: desenvolvimento e build.

\- TanStack Router: roteamento e validação dos parâmetros de busca.

\- TanStack Query: gerenciamento de consultas e cache.

\- Axios: cliente HTTP compartilhado.

\- Socket.IO Client: comunicação em tempo real.

\- MSW: interceptação de requisições no navegador.

\- Tailwind CSS e Radix UI: recursos de estilização e componentes.

\- Playwright: testes automatizados de ponta a ponta.



\## 3. Organização do código



\- `src/main.tsx`: inicialização da aplicação e ativação opcional dos mocks.

\- `src/app/`: configuração do roteador, aplicação e cliente de consultas.

\- `src/components/`: componentes compartilhados da interface.

\- `src/contracts/`: contratos e tipos para contas, NFTs, carrinho, pedidos e eventos.

\- `src/domain/`: regras de domínio relacionadas à autenticação, carrinho, checkout e valores monetários.

\- `src/features/`: funcionalidades de autenticação, catálogo, detalhes de NFTs, carrinho, checkout, pedidos e diagnóstico.

\- `src/lib/api/`: cliente Axios compartilhado.

\- `src/lib/auth/`: armazenamento e leitura da sessão.

\- `src/lib/realtime/`: conexão com o cliente Socket.IO.

\- `src/mocks/`: inicialização do MSW, handlers e dados simulados.

\- `tests/`: testes automatizados.

\- `public/`: arquivos públicos utilizados pela aplicação.



\## 4. Inicialização



A aplicação é iniciada em `src/main.tsx`.



Quando `VITE\_ENABLE\_MOCKS=true`, o módulo de mocks é carregado dinamicamente e `startMocks()` é aguardado antes da renderização da interface.



A árvore principal utiliza `React.StrictMode`, `QueryClientProvider` e `RouterProvider`.



\## 5. Rotas



As rotas são declaradas em `src/app/router.tsx`:



\- `/`: catálogo de NFTs.

\- `/nft/$nftId`: detalhes de um NFT.

\- `/cart`: carrinho.

\- `/login`: login.

\- `/register`: cadastro.

\- `/checkout`: checkout.

\- `/orders/$orderId`: acompanhamento de um pedido.

\- `/\_\_transport`: diagnóstico do transporte.



As páginas são carregadas sob demanda por meio de `lazyRouteComponent`.



A pesquisa do catálogo valida os filtros, os preços, a ordenação e a paginação. O parâmetro `returnTo` das rotas de autenticação é validado para aceitar destinos internos.



\## 6. Comunicação HTTP e sessão



O cliente compartilhado `src/lib/api/client.ts` utiliza Axios, define timeout de oito segundos e inclui o token armazenado no cabeçalho `Authorization` quando existe uma sessão.



Quando uma requisição autenticada retorna HTTP 401, a sessão é limpa e o evento de expiração é disparado para que a aplicação possa reagir.



O interceptor não implementa renovação automática de sessão.



\## 7. Comunicação em tempo real



A conexão é criada por `src/lib/realtime/socket.ts` usando `socket.io-client`, com transporte WebSocket e reconexão automática limitada.



O cliente registra os eventos `nft.updated` e `order.updated`, permitindo que as funcionalidades interessadas reajam às atualizações recebidas.



A conexão é importada dinamicamente para permitir que a inicialização dos mocks aconteça antes da abertura do WebSocket no ambiente simulado.



\## 8. Mocks



Os mocks são configurados em `src/mocks/browser.ts` com `setupWorker` e os handlers de `src/mocks/handlers.ts`.



As requisições sem handler geram erro por meio de `onUnhandledRequest: 'error'`, facilitando a identificação de operações que não foram simuladas.



A inicialização compartilha uma única promessa e permite nova tentativa se a inicialização falhar.



A variável `VITE\_ENABLE\_MOCKS` controla a ativação dos mocks no bootstrap da aplicação. Os comportamentos disponíveis e as limitações do transporte devem ser conferidos nos handlers e na documentação específica.



\## 9. Carrinho, checkout e pedidos



As funcionalidades são separadas em módulos próprios, com contratos e regras de domínio dedicados.



O checkout consulta novamente os dados da cotação antes de concluir a operação. Alterações de preço ou disponibilidade podem exigir nova revisão.



A criação de pedidos utiliza uma chave de idempotência e registra um retrato dos valores da operação. A aplicação contempla recuperação de pedidos pendentes e reconciliação com atualizações em tempo real.



A carteira, a conexão e o envio do pedido são simulados. Não ocorre pagamento real nem transação real de blockchain; a taxa de rede demonstrada é zero.



\## 10. Testes e validação



Os testes de ponta a ponta são implementados com Playwright e podem ser executados com:



`npm run test:e2e`



Verificações adicionais:



\- `npm run typecheck`: verifica os tipos TypeScript.

\- `npm run build`: gera a versão de produção.

\- `npm run dev`: inicia o servidor de desenvolvimento.

\- `npm run preview`: serve o build para validação local.



\## 11. Limitações e itens a validar



A aplicação utiliza serviços simulados para demonstração. Antes da entrega, devem ser conferidos a cobertura dos requisitos do desafio, os contratos REST e eventos, o isolamento de sessão, a persistência e o reset dos mocks, os cenários de falha, a acessibilidade, a responsividade e a auditoria Lighthouse.



O deploy público e o funcionamento de rotas acessadas diretamente devem ser validados no ambiente publicado.



\## 12. Documentação complementar



\- `README.md`: requisitos do desafio e instruções gerais.

\- `docs/auth-simulation.md`: documentação da autenticação simulada.

\- `docs/cart-rest-contract.md`: contrato relacionado ao carrinho.

\- `docs/catalog-rest-contract.md`: contrato relacionado ao catálogo.

\- `docs/order-rest-contract.md`: contrato relacionado a pedidos.

\- `docs/transport-poc.md`: documentação da prova de conceito do transporte.
