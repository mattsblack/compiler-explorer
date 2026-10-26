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

import path from 'node:path';

import {beforeAll, describe, expect, it, vi} from 'vitest';

import {CompilationEnvironment} from '../lib/compilation-env.js';
import {GroovyCompiler} from '../lib/compilers/index.js';
import {ParsedAsmResultLine} from '../types/asmresult/asmresult.interfaces.js';
import {CompilerInfo} from '../types/compiler.interfaces.js';
import {makeCompilationEnvironment} from './utils.js';

const languages = {
    groovy: {id: 'groovy'},
};

const info = {
    exe: '/opt/compiler-explorer/groovy-5.1.3/bin/groovyc',
    remote: true,
    lang: languages.groovy.id,
    id: 'groovy513',
    semver: '5.1.3',
} as unknown as CompilerInfo;

describe('Groovy compiler setup', () => {
    let env: CompilationEnvironment;
    let compiler: GroovyCompiler;

    beforeAll(() => {
        env = makeCompilationEnvironment({languages});
        compiler = new GroovyCompiler(info, env);
    });

    it('should not crash on instantiation', () => {
        expect(compiler).toBeInstanceOf(GroovyCompiler);
    });

    it('derives groovyHome from the executable path', () => {
        expect(compiler.groovyHome).toEqual(path.dirname(path.dirname(info.exe)));
    });

    it('uses the "groovy" compiler key', () => {
        expect(GroovyCompiler.key).toEqual('groovy');
    });

    it('produces example.class as the output file', () => {
        expect(compiler.getOutputFilename('/tmp/')).toEqual(path.join('/tmp/', 'example.class'));
    });

    it('always requests the javap bytecode view', () => {
        const filters = {binary: false} as any;
        expect(compiler.optionsForFilter(filters)).toEqual(['--encoding', 'utf8']);
        expect(filters.binary).toBe(true);
    });
});

describe('Groovy forbidden arguments', () => {
    const makeCompiler = () => new GroovyCompiler(info, makeCompilationEnvironment({languages}));

    for (const flag of ['-d', '-s', '-cp', '-classpath', '--classpath', '--configscript', '--temp', '--sourcepath']) {
        it(`drops ${flag} together with its argument`, () => {
            const compiler = makeCompiler();
            expect(compiler.filterUserOptions(['hello', flag, '--something', '--indy'])).toEqual(['hello', '--indy']);
            expect(compiler.filterUserOptions(['hello', flag])).toEqual(['hello']);
            expect(compiler.filterUserOptions([flag, 'something', 'something-else'])).toEqual(['something-else']);
        });
    }

    it('keeps harmless flags', () => {
        expect(makeCompiler().filterUserOptions(['--indy', '--parameters'])).toEqual(['--indy', '--parameters']);
    });
});

describe('Groovy main class detection', () => {
    const compiler = new GroovyCompiler(info, makeCompilationEnvironment({languages}));

    it('matches String[] mains', () => {
        expect(compiler.mainRegex.test('  public static void main(java.lang.String[]);')).toBe(true);
    });

    it('matches String... mains emitted for Groovy scripts', () => {
        expect(compiler.mainRegex.test('  public static void main(java.lang.String...);')).toBe(true);
    });

    it('matches non-void return types like Java does', () => {
        expect(compiler.mainRegex.test('  public static final void main(java.lang.String[]);')).toBe(true);
    });

    it('does not match other methods', () => {
        expect(compiler.mainRegex.test('  public static void run(java.lang.String...);')).toBe(false);
        expect(compiler.mainRegex.test('  public static void main(int);')).toBe(false);
    });
});

describe('Groovy javap parsing', () => {
    const compiler = new GroovyCompiler(info, makeCompilationEnvironment({languages}));

    const javapSquare = [
        'Compiled from "example.groovy"',
        'public class Square {',
        '  public static int square(int);',
        '    Code:',
        '       0: iload_0',
        '       1: iload_0',
        '       2: imul',
        '       3: ireturn',
        '    LineNumberTable:',
        '      line 6: 0',
        '}',
        '',
    ].join('\n');

    it('maps bytecode to source lines and drops the "Compiled from" header', async () => {
        const processed = await compiler.processAsm({asm: [{text: javapSquare}]});
        const segments = (processed as {asm: ParsedAsmResultLine[]}).asm;
        const withLine = (text: string) => ({text, source: {file: null, line: 6}});
        expect(segments).toEqual([
            {text: 'public class Square {', source: null},
            {text: '  public static int square(int);', source: null},
            withLine('       0: iload_0'),
            withLine('       1: iload_0'),
            withLine('       2: imul'),
            withLine('       3: ireturn'),
            {text: '', source: null},
            {text: '}', source: null},
        ]);
    });

    it('passes error documents through unchanged', async () => {
        await expect(compiler.processAsm({asm: '<Compilation failed>'})).resolves.toEqual({
            asm: [{text: '<Compilation failed>', source: null}],
        });
    });
});

describe('Groovy command line', () => {
    it('passes the output dir and user options to groovyc', async () => {
        const compiler = new GroovyCompiler(info, makeCompilationEnvironment({languages}));
        const exec = vi.spyOn(compiler, 'exec').mockResolvedValue({
            code: 0,
            timedOut: false,
            okToCache: true,
            filenameTransform: (f: string) => f,
            stdout: '',
            stderr: '',
            execTime: '1',
        } as any);

        await compiler.runCompiler(info.exe, ['--indy', '/tmp/x/example.groovy'], '/tmp/x/example.groovy', {
            customCwd: '/tmp/x',
            env: {},
        } as any);

        expect(exec).toHaveBeenCalledTimes(1);
        expect(exec.mock.calls[0][0]).toEqual(info.exe);
        expect(exec.mock.calls[0][1]).toEqual(['-d', '/tmp/x', '--indy', '/tmp/x/example.groovy']);
    });
});
