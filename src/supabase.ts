import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://buwzeodmfhagcrvqjuim.supabase.co';
const supabaseAnonKey = 'sb_publishable_d9gJ_BRrji-jxVy_BcyrhA_1uLTsyfg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);