# BotMonitoramentoOLX

Monitor de anúncios da OLX com filtros configuráveis e envio automático de alertas no Telegram.

O projeto foi feito para ser simples: Node.js, TypeScript, Axios, Cheerio, Telegram Bot API e persistência em JSON. A configuração dos alertas fica em `config/alerts.json`, então você adiciona novas buscas sem alterar código.

## O que ele faz

- Lê todos os alertas ativos em `config/alerts.json`
- Busca anúncios na OLX
- Extrai título, preço, link, localização, data e ID quando disponíveis
- Filtra preço, palavras obrigatórias e palavras bloqueadas
- Calcula score de oportunidade
- Evita anúncio repetido usando ID ou URL como chave única
- Envia alerta no Telegram
- Salva histórico em `data/sent-ads.json`
- Continua os próximos alertas mesmo se uma busca falhar

## Persistência escolhida

A escolha padrão é `JSON` em `data/sent-ads.json`.

Motivo: é a opção mais simples, grátis e fácil de manter no GitHub Actions. Como o Actions reinicia o ambiente a cada execução, o workflow commita automaticamente o arquivo `data/sent-ads.json` quando novos anúncios são processados.

O arquivo salva apenas:

- `id` do anúncio
- `url`
- `sentAt`

Não salva nome do vendedor, telefone, chat, perfil ou dados pessoais.

Alternativas:

- `SQLite`: bom para volume maior, mas exige commitar o banco ou usar artifact/cache. Para este projeto é mais pesado que o necessário.
- `Supabase`: bom se você não quiser commitar histórico no repositório, mas adiciona conta externa, chave de API e mais pontos de manutenção.

## Requisitos

- Node.js 20 ou superior
- Conta no Telegram
- Bot do Telegram
- Repositório no GitHub para rodar grátis via GitHub Actions

## Instalação local

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
npx playwright install chromium
```

Edite o `.env`:

```env
TELEGRAM_BOT_TOKEN=seu_token_aqui
TELEGRAM_CHAT_ID=seu_chat_id_aqui
OLX_FETCH_MODE=playwright
```

Rode:

```bash
npm run start
```

Verifique tipos:

```bash
npm run build
```

## Criar bot no Telegram

1. Abra o Telegram e procure por `@BotFather`
2. Envie `/newbot`
3. Escolha o nome do bot
4. Escolha o username do bot, terminando em `bot`
5. Copie o token gerado
6. Coloque o token em `TELEGRAM_BOT_TOKEN`

Nunca envie esse token para ninguém e nunca commite `.env`.

## Pegar o chat_id

1. Envie uma mensagem qualquer para o seu bot
2. Acesse no navegador:

```text
https://api.telegram.org/botSEU_TOKEN/getUpdates
```

3. Procure por:

```json
"chat": { "id": 123456789 }
```

4. Use esse número em `TELEGRAM_CHAT_ID`

Para grupos, adicione o bot no grupo, envie uma mensagem no grupo e rode o mesmo `getUpdates`. IDs de grupo normalmente são negativos.

## Configurar alertas

Edite `config/alerts.json`.

Exemplo:

```json
{
  "id": "ps5-abaixo-2000",
  "nome": "PS5 abaixo de 2 mil",
  "ativo": true,
  "termoBusca": "playstation 5",
  "urlBuscaOlx": "https://rj.olx.com.br/rio-de-janeiro-e-regiao?q=playstation%205",
  "precoMinimo": 1000,
  "precoMaximo": 2000,
  "palavrasObrigatorias": ["ps5", "playstation"],
  "palavrasBloqueadas": ["defeito", "não liga", "sucata", "banido", "peças"],
  "scoreMinimo": 50,
  "quantidadeMaximaPorExecucao": 5,
  "enviarTelegram": true
}
```

Campos:

- `id`: identificador único do alerta
- `nome`: nome exibido no Telegram
- `ativo`: liga ou desliga o alerta
- `termoBusca`: descrição humana da busca
- `urlBuscaOlx`: opcional; se não informar, o sistema monta uma URL da OLX RJ a partir de `termoBusca`
- `precoMinimo`: preço mínimo opcional
- `precoMaximo`: preço máximo opcional
- `palavrasObrigatorias`: pelo menos uma deve aparecer no anúncio
- `palavrasObrigatoriasTodas`: opcional; todas devem aparecer no título
- `palavrasBloqueadas`: opcional; se aparecerem, o anúncio é ignorado
- `categorias`: reservado para organização futura
- `scoreMinimo`: score mínimo opcional
- `maxPaginas`: opcional; quantas páginas buscar por alerta, com limite interno de 5
- `ordenarPorRecentes`: opcional; por padrão usa `true` e adiciona `sf=1` na URL da OLX
- `quantidadeMaximaPorExecucao`: limite anti-spam por alerta
- `enviarTelegram`: define se envia mensagem

Valores padrão quando o campo não existe no JSON:

- `urlBuscaOlx`: gerada automaticamente para OLX RJ
- `maxPaginas`: `2`
- `ordenarPorRecentes`: `true`
- `quantidadeMaximaPorExecucao`: `5`
- `enviarTelegram`: `true`

As palavras obrigatórias são checadas no título do anúncio. Isso reduz falsos positivos causados por textos de menu, filtros e recomendações que a OLX coloca no HTML da página.

## Score de oportunidade

O score vai de 0 a 100.

Aumenta com:

- preço bem abaixo do teto configurado
- termos como `urgente`, `hoje`, `preciso vender`, `desapego`, `baixei`
- anúncio com localização identificada

Diminui com:

- `defeito`
- `sem teste`
- `trincado`
- `quebrado`
- `sucata`
- `não liga`

Classificação:

- 🔥 Oportunidade alta: score 75+
- 🟡 Oportunidade média: score 45 a 74
- ⚪ Oportunidade baixa: abaixo de 45

## GitHub Actions grátis

O workflow está em `.github/workflows/monitor.yml`.

Ele roda:

- a cada 30 minutos
- manualmente pelo botão `workflow_dispatch`

Por padrão, o GitHub Actions não garante execução exatamente no minuto marcado. Pode atrasar em horários de pico.

## Configurar GitHub Secrets

No GitHub:

1. Abra o repositório
2. Vá em `Settings`
3. Vá em `Secrets and variables`
4. Clique em `Actions`
5. Clique em `New repository secret`
6. Crie:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

O workflow usa esses secrets sem expor valores no arquivo YAML.

## Deploy grátis

1. Suba o projeto para um repositório GitHub
2. Configure os GitHub Secrets
3. Vá na aba `Actions`
4. Ative workflows se o GitHub pedir confirmação
5. Rode `Monitor OLX` manualmente uma vez
6. Confira o Telegram e o arquivo `data/sent-ads.json`

Depois disso, a execução agendada roda sozinha.

## Segurança

- `.env` está no `.gitignore`
- `.env.example` não contém valores reais
- o workflow usa GitHub Secrets
- o código impede execução se variáveis obrigatórias estiverem ausentes
- `data/sent-ads.json` salva apenas ID, URL e data de envio
- não salve tokens em commits, issues, prints ou logs

Se o token vazar:

1. Abra `@BotFather`
2. Use `/revoke`
3. Escolha o bot
4. Gere um novo token
5. Atualize `TELEGRAM_BOT_TOKEN` nos GitHub Secrets
6. Apague qualquer commit, print ou mensagem que contenha o token

## Limites e riscos de scraping

A OLX pode:

- alterar o HTML
- bloquear requisições automatizadas
- exibir anúncios de forma diferente por região
- atrasar ou ocultar resultados
- exigir JavaScript em algumas páginas

Este projeto usa Playwright por padrão porque a OLX costuma bloquear requisições simples com `403`. O parser continua usando Cheerio sobre o HTML carregado.

Você pode mudar o modo com `OLX_FETCH_MODE`:

- `playwright`: padrão e recomendado atualmente
- `auto`: tenta Axios primeiro e usa Playwright se receber `403`
- `axios`: usa apenas Axios, útil só se a OLX voltar a aceitar requisições simples

Use intervalos responsáveis. O workflow padrão roda a cada 30 minutos e processa alertas em sequência, com delay entre buscas.

## Troubleshooting

`Variaveis obrigatorias ausentes`

Configure `.env` localmente ou GitHub Secrets no repositório.

`Nenhum anuncio encontrado`

A OLX pode ter alterado a página, bloqueado a requisição ou retornado HTML diferente. Confira se a URL abre no navegador.

`Telegram API error`

Confira se o token está correto, se o bot recebeu uma mensagem sua e se o `chat_id` é válido.

`GitHub Actions não commita sent-ads.json`

Confira se o workflow tem `permissions: contents: write` e se o repositório permite escrita por GitHub Actions em `Settings > Actions > General`.

`Muitos anúncios ruins`

Ajuste `palavrasBloqueadas`, aumente `scoreMinimo` ou reduza `precoMaximo`.

`Poucos anúncios`

Reduza `scoreMinimo`, revise `palavrasObrigatorias` e confirme a URL da OLX.

## Observações de manutenção

- Para adicionar alertas, edite apenas `config/alerts.json`
- Para pausar um alerta, use `"ativo": false`
- Para evitar spam, reduza `quantidadeMaximaPorExecucao`
- Para limpar histórico, edite `data/sent-ads.json` com cuidado
- Para trocar de região, gere uma nova URL no site da OLX e cole em `urlBuscaOlx`
