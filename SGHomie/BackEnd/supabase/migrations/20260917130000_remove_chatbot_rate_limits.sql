-- Remove the chatbot's durable request counter. Existing rate-limit rows are
-- ephemeral counters and are no longer needed once the application gate is gone.

DROP FUNCTION IF EXISTS public.consume_chatbot_rate_limit(timestamptz, text, integer);
DROP TABLE IF EXISTS public.chatbot_rate_limits;
