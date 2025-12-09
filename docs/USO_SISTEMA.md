# 📘 Manual de Uso do Sistema

Este guia explica como usar todas as funcionalidades do Layout Manager.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Dashboard](#dashboard)
3. [Gerenciando Clientes](#gerenciando-clientes)
4. [Gerenciando Modelos](#gerenciando-modelos)
5. [Gerenciando Tipos de Impressão](#gerenciando-tipos-de-impressão)
6. [Gerenciando Campos](#gerenciando-campos)
7. [Criando Layouts](#criando-layouts)
8. [Histórico de Alterações](#histórico-de-alterações)
9. [Gerenciando Usuários](#gerenciando-usuários)

---

## 🏠 Visão Geral

O Layout Manager é dividido em módulos acessíveis pelo menu lateral:

```
┌─────────────────────────────────────────┐
│  📊 Dashboard     - Visão geral         │
│  👥 Clientes      - Cadastro de clientes│
│  📄 Modelos       - Tipos de modelos    │
│  🖨️ Tipos         - Tipos de impressão  │
│  🏷️ Campos        - Campos disponíveis  │
│  📐 Layouts       - Layouts criados     │
│  📜 Histórico     - Log de alterações   │
│  👤 Usuários      - Gestão de acessos   │
└─────────────────────────────────────────┘
```

---

## 📊 Dashboard

A tela inicial mostra estatísticas do sistema:

- **Total de Clientes** cadastrados
- **Total de Modelos** disponíveis
- **Total de Tipos** de impressão
- **Total de Campos** cadastrados
- **Total de Layouts** criados

Use o Dashboard para ter uma visão rápida da situação do sistema.

---

## 👥 Gerenciando Clientes

### Cadastrar novo cliente

1. Clique em **Clientes** no menu
2. Clique no botão **+ Novo Cliente**
3. Preencha os dados:
   - **Nome** (obrigatório): Nome de identificação
   - **CNPJ** (obrigatório): Número do CNPJ

   > 💡 **Dica:** Digite apenas o CNPJ e clique em "Consultar CNPJ" para preencher automaticamente os outros dados

4. Complete os campos opcionais conforme necessário
5. Clique em **Salvar**

### Consulta automática de CNPJ

O sistema pode buscar dados públicos do CNPJ automaticamente:

1. Digite o CNPJ no campo
2. Clique no ícone de busca 🔍
3. Os dados serão preenchidos automaticamente:
   - Razão Social
   - Nome Fantasia
   - Endereço
   - Telefone
   - Situação cadastral

### Editar cliente

1. Na lista de clientes, clique no cliente desejado
2. Clique no botão **Editar** (ícone de lápis)
3. Faça as alterações
4. Clique em **Salvar**

### Excluir cliente

1. Na lista de clientes, clique no cliente desejado
2. Clique no botão **Excluir** (ícone de lixeira)
3. Confirme a exclusão

> ⚠️ **Atenção:** Ao excluir um cliente, todos os layouts associados também serão excluídos!

---

## 📄 Gerenciando Modelos

Modelos representam diferentes formatos de layout (ex: "Etiqueta Padrão", "Caixa Grande").

### Cadastrar modelo

1. Clique em **Modelos** no menu
2. Clique em **+ Novo Modelo**
3. Preencha:
   - **Nome** (obrigatório)
   - **Descrição** (opcional)
4. Clique em **Salvar**

### Editar/Excluir modelo

- Use os ícones de ação na lista de modelos
- Modelos em uso por layouts não podem ser excluídos

---

## 🖨️ Gerenciando Tipos de Impressão

Tipos de impressão indicam o método usado (ex: "Offset", "Digital", "Flexografia").

### Cadastrar tipo

1. Clique em **Tipos** no menu
2. Clique em **+ Novo Tipo**
3. Preencha:
   - **Nome** (obrigatório)
   - **Descrição** (opcional)
4. Clique em **Salvar**

---

## 🏷️ Gerenciando Campos

Campos são as informações que podem aparecer em um layout (ex: "Código de Barras", "Data de Validade").

### Cadastrar campo

1. Clique em **Campos** no menu
2. Clique em **+ Novo Campo**
3. Preencha:
   - **Nome** (obrigatório): Nome do campo
   - **Descrição** (opcional): Explicação do campo
4. Clique em **Salvar**

### Dica de organização

Crie campos padronizados para reutilizar em múltiplos layouts:
- `CODIGO_BARRAS`
- `DATA_FABRICACAO`
- `DATA_VALIDADE`
- `LOTE`
- `PESO_LIQUIDO`
- etc.

---

## 📐 Criando Layouts

Layouts são a combinação de **Cliente + Modelo + Tipo** com campos específicos.

### Criar novo layout

1. Clique em **Layouts** no menu
2. Clique em **+ Novo Layout**
3. Preencha as informações básicas:
   - **Nome do Layout**
   - **Cliente** (selecione da lista)
   - **Modelo** (selecione da lista)
   - **Tipo de Impressão** (selecione da lista)
4. Adicione os campos:
   - Clique em **Adicionar Campo**
   - Selecione o campo desejado
   - Defina a **ordem** do campo
   - Marque se é **obrigatório**
5. Clique em **Salvar**

### Adicionar imagem ao layout

1. Abra o layout para edição
2. Clique na área de imagem
3. Selecione uma imagem do seu computador
4. A imagem será salva automaticamente

### Clonar layout

Para criar um layout igual para outro cliente:

1. Na lista de layouts, encontre o layout original
2. Clique no ícone de **Clonar** (dois quadrados)
3. Selecione o **cliente de destino**
4. Clique em **Clonar**
5. O novo layout será criado com "(Clonado)" no nome

### Comparar layouts

Para ver diferenças entre layouts:

1. Na lista de layouts, selecione os layouts desejados (checkbox)
2. Clique no botão **Comparar**
3. Uma tabela mostrará:
   - Campos presentes em cada layout
   - Ordem dos campos
   - Campos obrigatórios
   - Diferenças destacadas em cores

---

## 📜 Histórico de Alterações

O sistema mantém registro de todas as alterações feitas.

### Visualizar histórico

1. Clique em **Histórico** no menu
2. Veja a lista de alterações com:
   - **Data/Hora** da alteração
   - **Usuário** que fez a alteração
   - **Tabela** afetada
   - **Ação** (Inserção, Atualização, Exclusão)
   - **Dados** antes e depois

### Filtrar histórico

Use os filtros para encontrar alterações específicas:
- Por período (data inicial e final)
- Por usuário
- Por tipo de ação
- Por tabela

---

## 👤 Gerenciando Usuários

> ⚠️ Esta seção é visível apenas para **administradores**.

### Tipos de usuários

| Tipo | Permissões |
|------|------------|
| **Administrador** | Acesso total ao sistema |
| **Usuário** | Permissões configuráveis por recurso |

### Cadastrar novo usuário

1. O usuário deve se cadastrar pela tela de login
2. Após o cadastro, a conta fica **inativa**
3. O administrador deve:
   - Acessar **Usuários**
   - Encontrar o novo usuário
   - Clicar em **Ativar**

### Configurar permissões

Para cada usuário, você pode definir permissões por recurso:

1. Clique em **Permissões** ao lado do usuário
2. Para cada recurso (Clientes, Modelos, etc.), defina:
   - ✅ **Visualizar**: Pode ver os dados
   - ✅ **Criar**: Pode adicionar novos registros
   - ✅ **Editar**: Pode modificar registros existentes
   - ✅ **Excluir**: Pode remover registros
3. Clique em **Salvar**

### Desativar usuário

1. Na lista de usuários, encontre o usuário
2. Clique no botão **Desativar**
3. O usuário não conseguirá mais fazer login

---

## 💡 Dicas de uso

### Busca rápida

- Use a barra de busca no topo das listas
- Pesquise por nome, CNPJ, ou qualquer campo visível

### Atalhos de teclado

| Atalho | Ação |
|--------|------|
| `Enter` | Confirmar/Salvar |
| `Esc` | Cancelar/Fechar |

### Ordenação

- Clique no cabeçalho das colunas para ordenar
- Clique novamente para inverter a ordem

### Exportação

- Algumas listagens permitem exportar dados
- Use o botão de exportar quando disponível

---

## 📚 Mais informações

- [README principal](../README.md)
- [Solução de problemas](TROUBLESHOOTING.md)
- [Configuração Docker](DOCKER.md)
