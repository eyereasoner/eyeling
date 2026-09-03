/** Cryptographic predicates compatible with Scryer's library(crypto).

The public predicate and data-format surface follows Scryer Prolog. Sensitive
primitives are delegated to EyeProlog's private host adapter, which uses Node's
cryptographic backend. Hex conversion and curve metadata retain the same Prolog
representations as Scryer.
*/

:- module(crypto, [
    hex_bytes/2,
    crypto_n_random_bytes/2,
    crypto_data_hash/3,
    crypto_data_hkdf/4,
    crypto_password_hash/2,
    crypto_password_hash/3,
    crypto_data_encrypt/6,
    crypto_data_decrypt/6,
    ed25519_seed_keypair/2,
    ed25519_new_keypair/1,
    ed25519_keypair_public_key/2,
    ed25519_sign/4,
    ed25519_verify/4,
    curve25519_generator/1,
    curve25519_scalar_mult/3,
    crypto_name_curve/2,
    crypto_curve_order/2,
    crypto_curve_generator/2,
    crypto_curve_scalar_mult/4
]).

hex_bytes(Hex, Bytes) :-
    eyeprolog__hex_bytes(Hex, Bytes).

crypto_n_random_bytes(N, Bytes) :-
    eyeprolog__crypto_n_random_bytes(N, Bytes).

crypto_data_hash(Data, Hash, Options) :-
    eyeprolog__crypto_data_hash(Data, Hash, Options).

crypto_data_hkdf(Data, Length, Bytes, Options) :-
    eyeprolog__crypto_data_hkdf(Data, Length, Bytes, Options).

crypto_password_hash(Password, Hash) :-
    eyeprolog__crypto_password_hash(Password, Hash).

crypto_password_hash(Password, Hash, Options) :-
    eyeprolog__crypto_password_hash(Password, Hash, Options).

crypto_data_encrypt(PlainText, Algorithm, Key, IV, CipherText, Options) :-
    eyeprolog__crypto_data_encrypt(PlainText, Algorithm, Key, IV, CipherText, Options).

crypto_data_decrypt(CipherText, Algorithm, Key, IV, PlainText, Options) :-
    eyeprolog__crypto_data_decrypt(CipherText, Algorithm, Key, IV, PlainText, Options).

ed25519_seed_keypair(Seed, KeyPair) :-
    eyeprolog__ed25519_seed_keypair(Seed, KeyPair).

ed25519_new_keypair(KeyPair) :-
    eyeprolog__ed25519_new_keypair(KeyPair).

ed25519_keypair_public_key(KeyPair, PublicKey) :-
    eyeprolog__ed25519_keypair_public_key(KeyPair, PublicKey).

ed25519_sign(KeyPair, Data, Signature, Options) :-
    eyeprolog__ed25519_sign(KeyPair, Data, Signature, Options).

ed25519_verify(PublicKey, Data, Signature, Options) :-
    eyeprolog__ed25519_verify(PublicKey, Data, Signature, Options).

curve25519_generator(Generator) :-
    eyeprolog__curve25519_generator(Generator).

curve25519_scalar_mult(Scalar, Point, Result) :-
    eyeprolog__curve25519_scalar_mult(Scalar, Point, Result).

crypto_curve_generator(curve(_,_,_,_,Generator,_,_,_), Generator).
crypto_curve_order(curve(_,_,_,_,_,Order,_,_), Order).

crypto_curve_scalar_mult(Curve, Scalar, Point, Result) :-
    eyeprolog__crypto_curve_scalar_mult(Curve, Scalar, Point, Result).

crypto_name_curve(secp256k1,
                  curve(secp256k1,
                        0x00fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f,
                        0x0,
                        0x7,
                        point(0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798,
                              0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8),
                        0x00fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141,
                        32,
                        1)).
