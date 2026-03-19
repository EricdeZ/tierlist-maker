-- Two-step signature: player signs → owner approves
ALTER TABLE cc_signature_requests ADD COLUMN pending_signature_url TEXT DEFAULT NULL;
