/**
 * Declaración de tipos para `@sphereon/react-native-argon2`, que no distribuye
 * sus propios tipos. Modela la API descrita en su README.
 */
declare module '@sphereon/react-native-argon2' {
  export interface Argon2Config {
    /** `t`: número de iteraciones. */
    iterations?: number;
    /** `m`: memoria en KiB. */
    memory?: number;
    /** `p`: grado de paralelismo. */
    parallelism?: number;
    /** Longitud de la salida en bytes. */
    hashLength?: number;
    /** Variante de Argon2. */
    mode?: 'argon2d' | 'argon2i' | 'argon2id';
  }

  export interface Argon2Result {
    /** Representación hexadecimal del hash derivado. */
    rawHash: string;
    /** Representación PHC (`$argon2id$v=19$m=...`) con parámetros y salt. */
    encodedHash: string;
  }

  /**
   * Deriva una clave con Argon2. `salt` se consume como cadena (sus bytes UTF-8
   * son el salt). Devuelve el hash en formato hex y PHC.
   */
  export default function argon2(
    password: string,
    salt: string,
    config: Argon2Config
  ): Promise<Argon2Result>;
}
