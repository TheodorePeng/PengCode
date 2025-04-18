# cython: language_level=3
# cython: cdivision=True
from libc.stdint cimport int32_t
from libc.stdio cimport FILE


cdef extern from "base16384.h" nogil:
    int BASE16384_ENCBUFSZ
    int BASE16384_DECBUFSZ

    int BASE16384_FLAG_NOHEADER
    int BASE16384_FLAG_SUM_CHECK_ON_REMAIN
    int BASE16384_FLAG_DO_SUM_CHECK_FORCELY

    ctypedef enum base16384_err_t:
        base16384_err_ok
        base16384_err_get_file_size
        base16384_err_fopen_output_file
        base16384_err_fopen_input_file
        base16384_err_write_file
        base16384_err_open_input_file
        base16384_err_map_input_file
        base16384_err_read_file
        base16384_err_invalid_file_name
        base16384_err_invalid_commandline_parameter
        base16384_err_invalid_decoding_checksum
    # encode_len calc min buf size to fill encode result
    int b14_encode_len "base16384_encode_len" (int dlen)
# decode_len calc min buf size to fill decode result
    int b14_decode_len "base16384_decode_len" (int dlen, int offset)

    int b14_encode_safe "base16384_encode_safe" (const char * data, int dlen, char * buf)
# encode data and write result into buf
    int b14_encode "base16384_encode" (const char* data, int dlen, char* buf)

    int b14_encode_unsafe "base16384_encode_unsafe" (const char * data, int dlen, char * buf)
# decode data and write result into buf
    int b14_decode_safe "base16384_decode_safe" (const char * data, int dlen, char * buf)

    int b14_decode "base16384_decode" (const char* data, int dlen, char* buf)

    int b14_decode_unsafe "base16384_decode_unsafe"(const char * data, int dlen, char * buf)

    base16384_err_t b14_encode_file "base16384_encode_file" (const char * input, const char * output, char * encbuf, char * decbuf)
    base16384_err_t b14_decode_file "base16384_decode_file" (const char * input, const char * output, char * encbuf, char * decbuf)

    base16384_err_t b14_encode_fp "base16384_encode_fp" (FILE* input, FILE* output, char* encbuf, char* decbuf)

    # base16384_encode_fd encodes input fd to output fd.
    #    encbuf & decbuf must be no less than BASE16384_ENCBUFSZ & BASE16384_DECBUFSZ
    base16384_err_t b14_encode_fd "base16384_encode_fd" (int input, int output, char* encbuf, char* decbuf)


    # base16384_decode_fp decodes input file to output file.
    #    encbuf & decbuf must be no less than BASE16384_ENCBUFSZ & BASE16384_DECBUFSZ
    base16384_err_t b14_decode_fp "base16384_decode_fp"(FILE* input, FILE* output, char* encbuf, char* decbuf)

    # base16384_decode_fd decodes input fd to output fd.
    #    encbuf & decbuf must be no less than BASE16384_ENCBUFSZ & BASE16384_DECBUFSZ
    base16384_err_t b14_decode_fd "base16384_decode_fd"(int input, int output, char* encbuf, char* decbuf)

    # detailed
        # base16384_encode_file_detailed encodes input file to output file.
    #    use `-` to specify stdin/stdout
    #    encbuf & decbuf must be no less than BASE16384_ENCBUFSZ & BASE16384_DECBUFSZ
    base16384_err_t b14_encode_file_detailed "base16384_encode_file_detailed" (const char* input, const char* output, char* encbuf, char* decbuf, int flag)

    # base16384_encode_fp_detailed encodes input file to output file.
    #    encbuf & decbuf must be no less than BASE16384_ENCBUFSZ & BASE16384_DECBUFSZ
    base16384_err_t b14_encode_fp_detailed "base16384_encode_fp_detailed" (FILE* input, FILE* output, char* encbuf, char* decbuf, int flag)

    # base16384_encode_fd_detailed encodes input fd to output fd.
    #    encbuf & decbuf must be no less than BASE16384_ENCBUFSZ & BASE16384_DECBUFSZ
    base16384_err_t b14_encode_fd_detailed "base16384_encode_fd_detailed" (int input, int output, char* encbuf, char* decbuf, int flag)

    # base16384_decode_file_detailed decodes input file to output file.
    #    use `-` to specify stdin/stdout
    #    encbuf & decbuf must be no less than BASE16384_ENCBUFSZ & BASE16384_DECBUFSZ
    base16384_err_t b14_decode_file_detailed "base16384_decode_file_detailed" (const char* input, const char* output, char* encbuf, char* decbuf, int flag)

    # base16384_decode_fp_detailed decodes input file to output file.
    #    encbuf & decbuf must be no less than BASE16384_ENCBUFSZ & BASE16384_DECBUFSZ
    base16384_err_t b14_decode_fp_detailed "base16384_decode_fp_detailed" (FILE* input, FILE* output, char* encbuf, char* decbuf, int flag)

    # base16384_decode_fd_detailed decodes input fd to output fd.
    #    encbuf & decbuf must be no less than BASE16384_ENCBUFSZ & BASE16384_DECBUFSZ
    base16384_err_t b14_decode_fd_detailed "base16384_decode_fd_detailed" (int input, int output, char* encbuf, char* decbuf, int flag)


cdef extern from * nogil:
    """
#ifdef CPUBIT32
#define pybase16384_64bits() (0)
#else
#define pybase16384_64bits() (1)
#endif
    """
    int32_t pybase16384_64bits()
