# Design: Layout Responsivo e Dark Mode

**Data:** 2026-05-24
**Status:** Aprovado

## Problema

Após testes, foram identificados dois problemas no frontend:

1. O layout foi feito exclusivamente para mobile (`max-w-md` fixo, sem breakpoints). Em desktops, o conteúdo fica em uma faixa estreita de 448px no centro da tela.
2. As cores de componentes são hardcoded em classes Tailwind (`bg-white`, `bg-gray-50`, `text-gray-500`) e não respondem ao dark mode do sistema operacional. Em dark mode, cards ficam brancos e textos perdem contraste.

## Requisitos

- O app deve funcionar bem em navegadores desktop e mobile.
- O dark mode deve seguir a preferência do sistema operacional por padrão.
- Um botão de alternância (toggle) deve estar disponível no topo da interface para o usuário sobrescrever a preferência manualmente.
- A escolha manual deve ser persistida entre sessões.
- Páginas de autenticação (login/registro) não precisam de sidebar — permanecem centradas.

## Decisões de Design

### Layout desktop: sidebar lateral (Opção B)

No desktop (`lg:` e acima), uma sidebar fixa de ~200px aparece à esquerda com navegação, botão de logout e o toggle de tema. O conteúdo principal ocupa o restante da largura.

No mobile (abaixo de `lg`), a sidebar fica oculta e o layout atual em coluna única é mantido, com o header inline em cada página (usuário, links, logout).

### Dark mode: paleta slate (Opção B)

| Elemento | Light | Dark |
|---|---|---|
| Fundo de página | `bg-gray-50` | `dark:bg-slate-900` |
| Cards / painéis | `bg-white` | `dark:bg-slate-800` |
| Sidebar | — | `dark:bg-slate-800` |
| Bordas | `border` | `dark:border-slate-700` |
| Texto principal | padrão | `dark:text-slate-100` |
| Texto secundário | `text-gray-500` | `dark:text-slate-400` |
| Texto terciário | `text-gray-400` | `dark:text-slate-500` |
| Inputs (fundo) | `bg-white` | `dark:bg-slate-700` |
| Inputs (borda) | `border` | `dark:border-slate-600` |
| Inputs (texto) | padrão | `dark:text-slate-100` |
| Inputs (placeholder) | — | `dark:placeholder-slate-400` |

Botões laranja, verde de vendas e vermelho de erro não mudam — funcionam bem nos dois temas.

### Implementação do tema: `next-themes` + Tailwind `dark:` (Abordagem A)

`next-themes` gerencia o `ThemeProvider` no layout raiz, setando `class` no `<html>` (`darkMode: 'class'` no Tailwind). `defaultTheme="system"` faz o app seguir o SO por padrão. A escolha manual é persistida automaticamente no `localStorage`. O hook `useTheme()` é usado no componente de toggle.

## Arquitetura

### Novos componentes

**`src/components/Sidebar.tsx`**
- Exibido apenas em `lg:` e acima (`hidden lg:flex`)
- Contém: nome/logo do app, links de navegação (Dashboard, Produtos), `LogoutButton`, `ThemeToggle`
- Cores: `bg-white dark:bg-slate-800` com borda direita `border-r dark:border-slate-700`

**`src/components/ThemeToggle.tsx`**
- Botão client-side com `useTheme()` do `next-themes`
- Ícone ☀️ quando em dark mode (clica para ir para light), 🌙 quando em light mode (clica para ir para dark)
- Posicionado no topo da sidebar no desktop; no header mobile inline nas páginas protegidas

### Modificações em arquivos existentes

**`src/app/layout.tsx`**
- Adiciona `ThemeProvider` do `next-themes` envolvendo o `<body>`, com `attribute="class"` e `defaultTheme="system"`
- Estrutura de layout no desktop: `<div class="flex min-h-screen">` com `<Sidebar />` + `<main class="flex-1">` 

**`src/app/globals.css`**
- Remove as variáveis CSS de dark mode (`:root` com `@media prefers-color-scheme: dark`) — o controle passa para o Tailwind `dark:` via classe
- Mantém apenas o reset base (`body`, `font-family`)
- Adiciona `darkMode: 'class'` via diretiva Tailwind

**`src/app/dashboard/page.tsx`**
- Remove `max-w-md mx-auto` (largura controlada pelo layout pai no desktop)
- Fundo de página: `bg-gray-50 dark:bg-slate-900`
- Card de total: `bg-white dark:bg-slate-800`
- Textos: variantes `dark:text-slate-*` conforme mapeamento
- Header inline (usuário + links) permanece visível apenas no mobile (`lg:hidden`)
- Grid de produtos: `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

**`src/app/dashboard/ProductButton.tsx`**
- Sem alterações (laranja/verde/vermelho funcionam nos dois temas)

**`src/app/dashboard/LogoutButton.tsx`**
- Sem alterações estruturais; é referenciado pelo `Sidebar` no desktop e permanece no header mobile inline

**`src/app/products/page.tsx`**
- Remove `max-w-md mx-auto`
- Cards de produto: `bg-white dark:bg-slate-800 border dark:border-slate-700`
- Texto de custo: `text-gray-400 dark:text-slate-500`
- Header inline permanece visível apenas no mobile (`lg:hidden`)

**`src/app/products/new/page.tsx`**
- Inputs: adiciona `dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400`
- Labels: adiciona `dark:text-slate-200`

**`src/app/(auth)/layout.tsx`**
- Fundo: `bg-gray-50 dark:bg-slate-900`
- Card central: `bg-white dark:bg-slate-800`
- Sem sidebar (layout de auth é isolado)

**`src/app/(auth)/login/page.tsx`** e **`src/app/(auth)/register/page.tsx`**
- Inputs e labels: mesmas variantes `dark:` de `products/new`
- Labels: `dark:text-slate-200`

### Dependência nova

```
next-themes
```

Sem subdependências relevantes. Compatível com Next.js App Router.

## Fluxo de tema

1. Usuário acessa o app pela primeira vez → `next-themes` lê `prefers-color-scheme` do SO → aplica `light` ou `dark` na classe do `<html>`
2. Usuário clica no `ThemeToggle` → `useTheme()` alterna o tema e salva em `localStorage`
3. Próximos acessos → `next-themes` lê `localStorage` primeiro, ignorando o SO

## O que não muda

- Lógica de autenticação, rotas, server actions e APIs — nenhuma alteração
- Estrutura mobile das páginas (coluna única, header inline)
- Páginas de auth (login/registro) — apenas recebem variantes `dark:` nas cores
- Cores funcionais: laranja (`orange-500`), verde (`green-600`), vermelho (`red-500`)
