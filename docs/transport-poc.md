# Prova de transporte da fundação

## O que foi exercitado

- `src/lib/api/client.ts` centraliza as chamadas Axios. A tela diagnóstica faz `GET /api/health` e só marca sucesso quando recebe `source: "msw-rest"`.
- `src/mocks/handlers.ts` intercepta essa rota com MSW no navegador. O worker é iniciado antes da chamada HTTP.
- `src/lib/realtime/socket.ts` importa `socket.io-client` sob demanda, depois que o worker do MSW está ativo.
- O cliente Socket.IO usa WebSocket (`transports: ["websocket"]`). O evento `nft.updated` chega ao cliente pelo `@mswjs/socket.io-binding`; a interface verifica `nftId` e `version` antes de marcar a prova como aprovada.
- `tests/e2e/transport-smoke.spec.ts` confirma os dois resultados observando o estado da interface no Chromium.

## Detalhes e limitações do mock

- O handler `ws.link` é registrado na raiz do host. O MSW 2.15 remove o prefixo padrão `/socket.io/` antes de comparar URLs.
- O binding agenda os frames iniciais do handshake Engine.IO. O evento de prova é emitido na microtask seguinte para respeitar essa ordem.
- No handler do mock, o wrapper `client` do binding envia os frames para o navegador. Usar `server.emit()` tentaria escrever no WebSocket do servidor original.
- O binding declara suporte parcial ao protocolo Socket.IO: esta etapa usa eventos diretos e não depende de rooms, namespaces ou broadcasting.
- A prova usa transporte WebSocket direto; não valida o fallback de long polling do Socket.IO.
- MSW usa `@mswjs/interceptors@0.41.9`, enquanto o binding resolve `@mswjs/interceptors@0.39.8` pela faixa de dependência própria. O projeto também fixa `0.44.0` como dependência direta prevista no plano inicial. `npm ls` não reporta peer inválido e a prova em Chromium passou cinco vezes; não foi aplicado override especulativo.
- `VITE_ENABLE_MOCKS=true` habilita a simulação em desenvolvimento e no build de demonstração. `src/mocks/browser.ts` compartilha a Promise de inicialização para evitar duas ativações concorrentes no Strict Mode do React.

Esta prova é uma fundação técnica, não implementa ainda os eventos de negócio, reconexão, rooms, persistência ou reconciliação REST/Socket.IO exigidos pelo marketplace.
