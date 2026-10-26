// Copyright (c) 2026, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import * as monaco from 'monaco-editor';

function definition(): monaco.languages.IMonarchLanguage {
    return {
        defaultToken: '',
        tokenPostfix: '.groovy',

        keywords: [
            'abstract',
            'as',
            'assert',
            'break',
            'case',
            'catch',
            'class',
            'const',
            'continue',
            'def',
            'default',
            'do',
            'else',
            'enum',
            'extends',
            'final',
            'finally',
            'for',
            'goto',
            'if',
            'implements',
            'import',
            'in',
            'instanceof',
            'interface',
            'native',
            'new',
            'package',
            'private',
            'protected',
            'public',
            'return',
            'static',
            'strictfp',
            'super',
            'switch',
            'synchronized',
            'this',
            'threadsafe',
            'throw',
            'throws',
            'trait',
            'transient',
            'try',
            'var',
            'volatile',
            'while',
            'yield',
        ],
        typeKeywords: [
            'boolean',
            'byte',
            'char',
            'double',
            'float',
            'int',
            'long',
            'short',
            'void',
            'String',
            'Object',
            'List',
            'Map',
            'Set',
            'Closure',
            'BigDecimal',
            'BigInteger',
        ],
        constants: ['true', 'false', 'null'],

        operators: [
            '=',
            '>',
            '<',
            '!',
            '~',
            '?',
            ':',
            '==',
            '<=',
            '>=',
            '!=',
            '<=>',
            '&&',
            '||',
            '++',
            '--',
            '+',
            '-',
            '*',
            '/',
            '&',
            '|',
            '^',
            '%',
            '<<',
            '>>',
            '>>>',
            '+=',
            '-=',
            '*=',
            '/=',
            '&=',
            '|=',
            '^=',
            '%=',
            '<<=',
            '>>=',
            '>>>=',
            '?.',
            '?:',
            '*.',
            '.&',
            '.@',
            '=~',
            '==~',
            '..',
            '..<',
            '->',
            '**',
            '**=',
            '::',
        ],

        symbols: /[=><!~?:&|+\-*/^%.@]+/,
        escapes: /\\(?:[abfnrtv\\"'$]|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4})/,

        tokenizer: {
            root: [
                [/^#!.*$/, 'comment'],
                [/[a-zA-Z_$][\w$]*(?=\s*:(?!:))/, 'key'],
                [/[A-Z][\w$]*/, {cases: {'@typeKeywords': 'keyword', '@default': 'type.identifier'}}],
                [
                    /[a-z_$][\w$]*/,
                    {
                        cases: {
                            '@keywords': 'keyword',
                            '@typeKeywords': 'keyword',
                            '@constants': 'constant',
                            '@default': 'identifier',
                        },
                    },
                ],
                {include: '@whitespace'},
                [/[{}()[\]]/, '@brackets'],
                [/@symbols/, {cases: {'@operators': 'operator', '@default': ''}}],
                [/@[a-zA-Z_$][\w$]*/, 'annotation'],

                [/\d*\.\d+([eE][-+]?\d+)?[fFdDgG]?/, 'number.float'],
                [/0[xX][0-9a-fA-F_]+[lLiIgG]?/, 'number.hex'],
                [/0[bB][01_]+[lLiIgG]?/, 'number.binary'],
                [/\d[\d_]*[lLiIfFdDgG]?/, 'number'],

                [/[;,.]/, 'delimiter'],

                // slashy string (heuristic: only after operators/open brackets)
                [/"""/, 'string', '@gstringTriple'],
                [/'''/, 'string', '@stringTriple'],
                [/"/, 'string', '@gstring'],
                [/'/, 'string', '@string'],
            ],

            whitespace: [
                [/[ \t\r\n]+/, 'white'],
                [/\/\*/, 'comment', '@comment'],
                [/\/\/.*$/, 'comment'],
            ],

            comment: [
                [/[^/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/[/*]/, 'comment'],
            ],

            string: [
                [/[^\\']+/, 'string'],
                [/@escapes/, 'string.escape'],
                [/\\./, 'string.escape.invalid'],
                [/'/, 'string', '@pop'],
            ],
            stringTriple: [
                [/[^\\']+/, 'string'],
                [/@escapes/, 'string.escape'],
                [/\\./, 'string.escape.invalid'],
                [/'''/, 'string', '@pop'],
                [/'/, 'string'],
            ],

            gstring: [
                [/\$\{/, {token: 'delimiter.bracket', next: '@interpolation'}],
                [/\$[a-zA-Z_][\w]*(\.[a-zA-Z_][\w]*)*/, 'variable'],
                [/[^\\"$]+/, 'string'],
                [/@escapes/, 'string.escape'],
                [/\\./, 'string.escape.invalid'],
                [/\$/, 'string'],
                [/"/, 'string', '@pop'],
            ],
            gstringTriple: [
                [/\$\{/, {token: 'delimiter.bracket', next: '@interpolation'}],
                [/\$[a-zA-Z_][\w]*(\.[a-zA-Z_][\w]*)*/, 'variable'],
                [/[^\\"$]+/, 'string'],
                [/@escapes/, 'string.escape'],
                [/\\./, 'string.escape.invalid'],
                [/"""/, 'string', '@pop'],
                [/["$]/, 'string'],
            ],
            interpolation: [[/\}/, {token: 'delimiter.bracket', next: '@pop'}], {include: 'root'}],
        },
    } as monaco.languages.IMonarchLanguage;
}

monaco.languages.register({id: 'groovy'});
monaco.languages.setMonarchTokensProvider('groovy', definition());
monaco.languages.setLanguageConfiguration('groovy', {
    comments: {lineComment: '//', blockComment: ['/*', '*/']},
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
    ],
    autoClosingPairs: [
        {open: '{', close: '}'},
        {open: '[', close: ']'},
        {open: '(', close: ')'},
        {open: '"', close: '"', notIn: ['string']},
        {open: "'", close: "'", notIn: ['string', 'comment']},
    ],
    surroundingPairs: [
        {open: '{', close: '}'},
        {open: '[', close: ']'},
        {open: '(', close: ')'},
        {open: '"', close: '"'},
        {open: "'", close: "'"},
    ],
});
