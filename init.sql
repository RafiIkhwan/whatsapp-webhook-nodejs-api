-- Database initialization script for WhatsApp Analytics App

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    first_message_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW(),
    total_messages INTEGER DEFAULT 0,
    segment VARCHAR(100),
    segment_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    session_start TIMESTAMP DEFAULT NOW(),
    session_end TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    waha_message_id VARCHAR(255) UNIQUE NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20),
    message_body TEXT,
    timestamp TIMESTAMP NOT NULL,
    is_from_me BOOLEAN DEFAULT FALSE,
    status VARCHAR(50),
    reply_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(segment);
CREATE INDEX IF NOT EXISTS idx_customers_last_message ON customers(last_message_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer ON chat_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_start ON chat_sessions(session_start);

CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_waha_id ON messages(waha_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_from_me ON messages(is_from_me);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- INSERT INTO customers (phone_number, name) VALUES 
-- ('6281234567890', 'John Doe'),
-- ('6289876543210', 'Jane Smith');

-- Create a view for customer analytics
CREATE OR REPLACE VIEW customer_analytics AS
SELECT 
    c.id,
    c.phone_number,
    c.name,
    c.segment,
    c.total_messages,
    c.first_message_at,
    c.last_message_at,
    COUNT(DISTINCT cs.id) as total_sessions,
    COUNT(DISTINCT CASE WHEN cs.is_active THEN cs.id END) as active_sessions,
    AVG(cs.message_count) as avg_messages_per_session,
    EXTRACT(EPOCH FROM (c.last_message_at - c.first_message_at)) / 86400 as days_as_customer
FROM customers c
LEFT JOIN chat_sessions cs ON c.id = cs.customer_id
GROUP BY c.id, c.phone_number, c.name, c.segment, c.total_messages, c.first_message_at, c.last_message_at;