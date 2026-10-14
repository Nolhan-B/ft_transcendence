export const API_URL = '/api';
export const getWsUrl = (token: string) => `ws://${window.location.host}/api/game/ws?token=${token}`;