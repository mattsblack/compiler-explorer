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
import {describe, expect, it} from 'vitest';

import '../../modes/groovy-mode.js';

/** Each line's tokens as [text, type], with the language suffix and whitespace-only tokens dropped. */
function tokens(source: string): [string, string][][] {
    const lines = source.split('\n');
    return monaco.editor
        .tokenize(source, 'groovy')
        .map((row, index) =>
            row
                .map((token, i): [string, string] => [
                    lines[index].slice(token.offset, row[i + 1]?.offset),
                    token.type.replace(/\.groovy$/, ''),
                ])
                .filter(([text]) => text.trim() !== ''),
        );
}

describe('groovy mode', () => {
    it('tokenizes keywords, identifiers and constants', () => {
        const rows = tokens('def x = null');
        expect(rows[0]).toEqual([
            ['def', 'keyword'],
            ['x', 'identifier'],
            ['=', 'operator'],
            ['null', 'constant'],
        ]);
    });

    it('distinguishes built-in types from user-defined types', () => {
        const rows = tokens(['List<String> xs', 'Square s'].join('\n'));
        expect(rows[0]).toEqual([
            ['List', 'keyword'],
            ['<', 'operator'],
            ['String', 'keyword'],
            ['>', 'operator'],
            ['xs', 'identifier'],
        ]);
        expect(rows[1]).toEqual([
            ['Square', 'type.identifier'],
            ['s', 'identifier'],
        ]);
    });

    it('reads annotations as annotations, not operators', () => {
        const rows = tokens(['@CompileStatic', 'class Foo extends Bar {'].join('\n'));
        expect(rows[0]).toEqual([['@CompileStatic', 'annotation']]);
        expect(rows[1]).toEqual([
            ['class', 'keyword'],
            ['Foo', 'type.identifier'],
            ['extends', 'keyword'],
            ['Bar', 'type.identifier'],
            ['{', 'delimiter.curly'],
        ]);
    });

    it('tokenizes a method signature like the default example', () => {
        const rows = tokens('static int square(int num) {');
        expect(rows[0]).toEqual([
            ['static', 'keyword'],
            ['int', 'keyword'],
            ['square', 'identifier'],
            ['(', 'delimiter.parenthesis'],
            ['int', 'keyword'],
            ['num', 'identifier'],
            [')', 'delimiter.parenthesis'],
            ['{', 'delimiter.curly'],
        ]);
    });

    it('tokenizes the different numeric literals', () => {
        const rows = tokens('[1, 2.5, 0xFF, 0b101, 1_000L]');
        expect(rows[0]).toEqual([
            ['[', 'delimiter.square'],
            ['1', 'number'],
            [',', 'delimiter'],
            ['2.5', 'number.float'],
            [',', 'delimiter'],
            ['0xFF', 'number.hex'],
            [',', 'delimiter'],
            ['0b101', 'number.binary'],
            [',', 'delimiter'],
            ['1_000L', 'number'],
            [']', 'delimiter.square'],
        ]);
    });

    it('reads map keys as keys, but keeps switch labels as keywords', () => {
        const rows = tokens(['[a: 1, b: 2]', 'default:'].join('\n'));
        expect(rows[0]).toEqual([
            ['[', 'delimiter.square'],
            ['a', 'key'],
            [':', 'operator'],
            ['1', 'number'],
            [',', 'delimiter'],
            ['b', 'key'],
            [':', 'operator'],
            ['2', 'number'],
            [']', 'delimiter.square'],
        ]);
        expect(rows[1]).toEqual([
            ['default', 'keyword'],
            [':', 'operator'],
        ]);
    });

    it('recognizes Groovy-specific operators', () => {
        const rows = tokens(['a?.b ?: c', 'x <=> y', '1..<5'].join('\n'));
        expect(rows[0]).toEqual([
            ['a', 'identifier'],
            ['?.', 'operator'],
            ['b', 'identifier'],
            ['?:', 'operator'],
            ['c', 'identifier'],
        ]);
        expect(rows[1]).toEqual([
            ['x', 'identifier'],
            ['<=>', 'operator'],
            ['y', 'identifier'],
        ]);
        expect(rows[2]).toEqual([
            ['1', 'number'],
            ['..<', 'operator'],
            ['5', 'number'],
        ]);
    });

    it('tokenizes single-quoted strings without interpolation', () => {
        const rows = tokens(["println 'hi'", "'$x'", "'a\\nb'"].join('\n'));
        expect(rows[0]).toEqual([
            ['println', 'identifier'],
            ["'hi'", 'string'],
        ]);
        expect(rows[1]).toEqual([["'$x'", 'string']]);
        expect(rows[2]).toEqual([
            ["'a", 'string'],
            ['\\n', 'string.escape'],
            ["b'", 'string'],
        ]);
    });

    it('tokenizes GString interpolation, both $name and ${expr}', () => {
        const rows = tokens('"Hi $name and ${a + b}!"');
        expect(rows[0]).toEqual([
            ['"Hi ', 'string'],
            ['$name', 'variable'],
            [' and ', 'string'],
            ['${', 'delimiter.bracket'],
            ['a', 'identifier'],
            ['+', 'operator'],
            ['b', 'identifier'],
            ['}', 'delimiter.bracket'],
            ['!"', 'string'],
        ]);
    });

    it('carries a triple-quoted GString across lines and then returns to code', () => {
        const rows = tokens(['def s = """', '  line $x', '"""', 'def y'].join('\n'));
        expect(rows[0]).toEqual([
            ['def', 'keyword'],
            ['s', 'identifier'],
            ['=', 'operator'],
            ['"""', 'string'],
        ]);
        expect(rows[1]).toEqual([
            ['  line ', 'string'],
            ['$x', 'variable'],
        ]);
        expect(rows[2]).toEqual([['"""', 'string']]);
        expect(rows[3]).toEqual([
            ['def', 'keyword'],
            ['y', 'identifier'],
        ]);
    });

    it('tokenizes line comments, block comments across lines, and a shebang', () => {
        const rows = tokens(['#!/usr/bin/env groovy', '// hi', '/* start', 'end */ def'].join('\n'));
        expect(rows[0]).toEqual([['#!/usr/bin/env groovy', 'comment']]);
        expect(rows[1]).toEqual([['// hi', 'comment']]);
        expect(rows[2]).toEqual([['/* start', 'comment']]);
        expect(rows[3]).toEqual([
            ['end */', 'comment'],
            ['def', 'keyword'],
        ]);
    });
});
