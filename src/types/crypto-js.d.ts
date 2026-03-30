declare module 'crypto-js' {
  namespace CryptoJS {
    interface WordArray {
      toString(encoder?: Encoder): string;
    }
    interface Encoder {
      stringify(wordArray: WordArray): string;
    }
    const enc: {
      Hex: Encoder;
      Base64: Encoder;
      Utf8: Encoder;
    };
    function MD5(message: string): WordArray;
    function SHA1(message: string): WordArray;
    function SHA256(message: string): WordArray;
    function SHA512(message: string): WordArray;
    function SHA3(message: string, options?: { outputLength: number }): WordArray;
  }
  export = CryptoJS;
}
