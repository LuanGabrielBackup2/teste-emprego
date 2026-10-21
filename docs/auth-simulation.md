# Autenticação simulada

O login e o cadastro usam endpoints REST interceptados pelo MSW. Não há provedor externo, servidor de identidade nem sessão real. O token `mock-*` é fictício e serve apenas para exercitar o fluxo no navegador.

Credenciais locais de demonstração:

- `maya@jungle.test` / `Jungle#2025`
- `noah@jungle.test` / `Canopy#2025`

As senhas fornecidas são comparadas por SHA-256 no handler e os mocks persistem somente o digest, nunca o texto da senha. O armazenamento local do navegador é um recurso de teste, não um cofre de credenciais. As contas e os tokens simulados ficam no localStorage para que a sessão e o cadastro persistam após refresh. A sessão demonstra expiração após 30 minutos; para reproduzir imediatamente no navegador, defina `jungle-market.scenario.session-expired=true` no localStorage e recarregue uma rota protegida.

Ao entrar, `POST /api/cart/merge-guest` soma as quantidades por NFT e mantém cupons, desde que as edições ainda estejam disponíveis. Se a soma ultrapassar o estoque, a API responde `409 CART_MERGE_REVIEW` sem modificar nenhum dos dois carrinhos. O carrinho visitante é migrado do formato `jungle-market.cart.v1` e passa a separar o estado visitante e o estado de cada usuário. Trocar de usuário remove o cache privado do TanStack Query.

Para simular falha de API no login, defina `jungle-market.scenario.auth-failure=true` no localStorage antes de enviar o formulário. Remova a chave para voltar ao comportamento normal.

Esses mecanismos são deliberadamente didáticos e não substituem autenticação, armazenamento de credenciais, proteção CSRF ou segurança de backend de produção.
