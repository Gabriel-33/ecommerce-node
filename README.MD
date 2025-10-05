# 🛒 E-commerce Backend - Supabase

Backend completo para sistema de e-commerce construído com Node.js, Express e Supabase.

## 🚀 Tecnologias

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Supabase** - Banco de dados PostgreSQL + Auth
- **JWT** - Autenticação
- **PostgreSQL** - Banco de dados

## 📦 Funcionalidades

### 🔐 Autenticação
- ✅ Registro de usuários
- ✅ Login com email/senha
- ✅ JWT Tokens
- ✅ Middleware de autenticação
- ✅ Perfis de usuário (customer/admin)

### 🛍️ Produtos
- ✅ CRUD completo de produtos
- ✅ Listagem com paginação
- ✅ Busca por nome
- ✅ Controle de estoque
- ✅ Políticas RLS de segurança

### 🛒 Pedidos
- ✅ Criação de pedidos
- ✅ Gestão de itens do pedido
- ✅ Cálculo automático de totais
- ✅ Status de pedidos
- ✅ Histórico por usuário

### 👥 Usuários
- ✅ Perfis de usuário
- ✅ Sistema de roles (customer/admin)
- ✅ Gestão de usuários (admin)

## 🏗️ Estrutura do Projeto
ecommerce-backend/
├── config/
│ └── supabase.js # Configuração do Supabase
├── controllers/
│ ├── authController.js # Autenticação
│ ├── productController.js # Produtos
│ ├── orderController.js # Pedidos
│ └── userController.js # Usuários
├── middleware/
│ ├── auth.js # Middleware de auth
│ └── validation.js # Validação de dados
├── routes/
│ ├── auth.js # Rotas de autenticação
│ ├── products.js # Rotas de produtos
│ ├── orders.js # Rotas de pedidos
│ └── users.js # Rotas de usuários
├── .env # Variáveis de ambiente
├── .gitignore # Arquivos ignorados pelo Git
├── package.json # Dependências do projeto
└── server.js # Servidor principal


## ⚙️ Configuração

### Pré-requisitos
- Node.js 16+
- Conta no Supabase
- PostgreSQL (opcional)

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/ecommerce-backend.git
cd ecommerce-backend
npm install 
```

### 2. Execute o sql no superbase
Vá até o arquivo schema.sql e rode no seu supabase

### 3. Crie um arquivo .env na raiz do projeto:
# Supabase Configuration
SUPABASE_URL=https://seu-project-ref.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Server Configuration
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Desenvolvimento
npm run dev

# Produção
npm start


