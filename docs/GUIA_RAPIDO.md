# 🚀 Guia Rápido de Instalação

Este guia mostra como colocar o Layout Manager rodando em menos de 10 minutos.

---

## ⚡ Instalação Express (Docker)

### Passo 1: Baixe o projeto

```bash
git clone https://github.com/seu-usuario/layout-manager.git
cd layout-manager
```

### Passo 2: Configure o ambiente

```bash
# Copiar arquivo de exemplo
cp .env.docker.example .env

# Gerar chave secreta
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Edite o arquivo `.env` e configure:
- `DB_PASSWORD` - Escolha uma senha forte
- `VITE_JWT_SECRET` - Cole a chave gerada acima

### Passo 3: Inicie o sistema

```bash
docker-compose -f docker-compose.with-db.yml up -d
```

### Passo 4: Acesse

Abra o navegador em: **http://localhost**

---

## ✅ Pronto!

Siga o assistente de configuração na tela para:
1. Criar o usuário administrador
2. Configurar o banco de dados
3. Finalizar a instalação

---

## 📚 Documentação completa

Para informações detalhadas, consulte:
- [README principal](../README.md)
- [Guia de Docker](DOCKER.md)
- [Solução de problemas](TROUBLESHOOTING.md)
