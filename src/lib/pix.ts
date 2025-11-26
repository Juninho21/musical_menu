
export class Pix {
    private key: string;
    private name: string;
    private city: string;
    private transactionId: string;
    private message: string;
    private amount: string | null;

    constructor(key: string, name: string, city: string, transactionId: string = '***', message: string = '', amount: string | null = null) {
        this.key = key;
        this.name = name;
        this.city = city;
        this.transactionId = transactionId;
        this.message = message;
        this.amount = amount;
    }

    private formatValue(id: string, value: string): string {
        const len = value.length.toString().padStart(2, '0');
        return `${id}${len}${value}`;
    }

    private getCRC16(payload: string): string {
        payload += '6304';
        let crc = 0xFFFF;
        for (let i = 0; i < payload.length; i++) {
            crc ^= payload.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) !== 0) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc = crc << 1;
                }
            }
        }
        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }

    public getPayload(): string {
        const payload = [
            this.formatValue('00', '01'), // Payload Format Indicator
            this.formatValue('26', [
                this.formatValue('00', 'BR.GOV.BCB.PIX'),
                this.formatValue('01', this.key),
                this.message ? this.formatValue('02', this.message) : ''
            ].join('')),
            this.formatValue('52', '0000'), // Merchant Category Code
            this.formatValue('53', '986'), // Transaction Currency (BRL)
            this.amount ? this.formatValue('54', parseFloat(this.amount).toFixed(2)) : '',
            this.formatValue('58', 'BR'), // Country Code
            this.formatValue('59', this.name), // Merchant Name
            this.formatValue('60', this.city), // Merchant City
            this.formatValue('62', [
                this.formatValue('05', this.transactionId)
            ].join(''))
        ].join('');

        return `${payload}6304${this.getCRC16(payload)}`;
    }
}
