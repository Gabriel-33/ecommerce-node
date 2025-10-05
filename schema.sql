-- =============================================
-- SISTEMA DE E-COMMERCE - SUPABASE
-- SQL COMPLETO PARA TESTE TÉCNICO
-- =============================================

-- =============================================
-- 1. CRIAÇÃO DAS TABELAS
-- =============================================

-- Tabela de perfis (extende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES profiles(id) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    total_amount DECIMAL(10,2) DEFAULT 0 CHECK (total_amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de itens do pedido
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Ativar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS PARA PROFILES
-- =============================================

-- Usuários podem ver apenas seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Usuários podem inserir seu próprio perfil (quando se registram)
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins podem fazer tudo em profiles
CREATE POLICY "Admins have full access to profiles" ON profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =============================================
-- POLÍTICAS PARA PRODUCTS
-- =============================================

-- Qualquer um pode ver produtos ativos
CREATE POLICY "Anyone can view active products" ON products
    FOR SELECT USING (is_active = true);

-- Apenas admins podem gerenciar produtos
CREATE POLICY "Only admins can manage products" ON products
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =============================================
-- POLÍTICAS PARA ORDERS
-- =============================================

-- Clientes veem apenas seus próprios pedidos
CREATE POLICY "Customers can view own orders" ON orders
    FOR SELECT USING (auth.uid() = customer_id);

-- Clientes podem criar pedidos
CREATE POLICY "Customers can create orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Clientes podem atualizar seus próprios pedidos (apenas status para cancelar)
CREATE POLICY "Customers can update own orders" ON orders
    FOR UPDATE USING (
        auth.uid() = customer_id AND 
        (status = 'pending' OR status = 'cancelled')
    );

-- Admins têm acesso total
CREATE POLICY "Admins have full order access" ON orders
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =============================================
-- POLÍTICAS PARA ORDER ITEMS
-- =============================================

-- Clientes veem itens apenas de seus pedidos
CREATE POLICY "Customers can view own order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND orders.customer_id = auth.uid()
        )
    );

-- Clientes podem adicionar itens aos seus pedidos
CREATE POLICY "Customers can insert own order items" ON order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND orders.customer_id = auth.uid()
            AND orders.status = 'pending'
        )
    );

-- Admins têm acesso total
CREATE POLICY "Admins have full order items access" ON order_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =============================================
-- 3. FUNÇÕES DE BANCO DE DADOS
-- =============================================

-- Função para calcular total do pedido
CREATE OR REPLACE FUNCTION calculate_order_total(order_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    total DECIMAL(10,2);
BEGIN
    SELECT COALESCE(SUM(subtotal), 0) INTO total
    FROM order_items
    WHERE order_items.order_id = $1;
    
    RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar status do pedido
CREATE OR REPLACE FUNCTION update_order_status(
    target_order_id UUID,
    new_status TEXT
) RETURNS VOID AS $$
BEGIN
    -- Validar status
    IF new_status NOT IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid order status: %', new_status;
    END IF;
    
    UPDATE orders 
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = target_order_id;
    
    -- Registrar no log (opcional)
    RAISE NOTICE 'Order % status updated to %', target_order_id, new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para diminuir estoque quando pedido é confirmado
CREATE OR REPLACE FUNCTION decrease_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status mudou para 'confirmed', diminuir estoque
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        UPDATE products p
        SET stock_quantity = stock_quantity - oi.quantity,
            updated_at = NOW()
        FROM order_items oi
        WHERE p.id = oi.product_id AND oi.order_id = NEW.id;
    END IF;
    
    -- Se o status mudou de 'confirmed' para outro, restaurar estoque
    IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
        UPDATE products p
        SET stock_quantity = stock_quantity + oi.quantity,
            updated_at = NOW()
        FROM order_items oi
        WHERE p.id = oi.product_id AND oi.order_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função do trigger para atualizar automaticamente o total do pedido
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        UPDATE orders 
        SET total_amount = calculate_order_total(COALESCE(NEW.order_id, OLD.order_id)),
            updated_at = NOW()
        WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 4. TRIGGERS
-- =============================================

-- Trigger para atualizar total do pedido automaticamente
DROP TRIGGER IF EXISTS update_order_total_trigger ON order_items;
CREATE TRIGGER update_order_total_trigger
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_order_total();

-- Trigger para gerenciar estoque
DROP TRIGGER IF EXISTS manage_inventory_trigger ON orders;
CREATE TRIGGER manage_inventory_trigger
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION decrease_product_stock();

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de updated_at nas tabelas
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 5. VIEWS PARA CONSULTAS EFICIENTES
-- =============================================

-- View para pedidos com detalhes do cliente
CREATE OR REPLACE VIEW order_details AS
SELECT 
    o.id,
    o.status,
    o.total_amount,
    o.created_at,
    o.updated_at,
    p.full_name as customer_name,
    p.email as customer_email,
    COUNT(oi.id) as items_count
FROM orders o
JOIN profiles p ON o.customer_id = p.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, p.full_name, p.email;

-- View para relatório de vendas
CREATE OR REPLACE VIEW sales_report AS
SELECT 
    DATE(o.created_at) as sale_date,
    COUNT(o.id) as orders_count,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as average_order_value,
    COUNT(DISTINCT o.customer_id) as unique_customers
FROM orders o
WHERE o.status != 'cancelled'
GROUP BY DATE(o.created_at)
ORDER BY sale_date DESC;

-- View para estoque crítico
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
    id,
    name,
    stock_quantity,
    price
FROM products
WHERE stock_quantity < 10 AND is_active = true
ORDER BY stock_quantity ASC;

-- View para detalhes completos dos itens do pedido
CREATE OR REPLACE VIEW order_items_details AS
SELECT 
    oi.id,
    oi.order_id,
    oi.quantity,
    oi.unit_price,
    oi.subtotal,
    oi.created_at,
    p.name as product_name,
    p.description as product_description
FROM order_items oi
LEFT JOIN products p ON oi.product_id = p.id;

-- =============================================
-- 6. DADOS DE EXEMPLO (OPCIONAL)
-- =============================================

-- Inserir produtos de exemplo (execute apenas se quiser dados de teste)
INSERT INTO products (name, description, price, stock_quantity) VALUES
('Smartphone XYZ', 'Celular top de linha com 128GB', 1999.99, 50),
('Notebook ABC', 'Notebook para trabalho e estudos', 3499.99, 25),
('Fone de Ouvido Bluetooth', 'Fone sem fio com cancelamento de ruído', 299.99, 100),
('Tablet Modern', 'Tablet 10 polegadas 64GB', 1299.99, 15),
('Smartwatch Pro', 'Relógio inteligente com GPS', 899.99, 30)
ON CONFLICT DO NOTHING;

-- =============================================
-- 7. ÍNDICES PARA PERFORMANCE (OPCIONAL)
-- =============================================

-- Índices para melhorar performance das queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- =============================================
-- FIM DO SCRIPT
-- =============================================

-- Comentário: Execute este script completo no SQL Editor do Supabase
-- Todas as tabelas, políticas RLS, funções e views serão criadas automaticamente