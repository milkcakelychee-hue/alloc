import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

/** settings แบบอัปเดตสด · undefined = กำลังโหลด */
export const useSettings = () => useLiveQuery(() => db.settings.get('app'), []);
