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

import _ from 'underscore';

import {
    BypassCache,
    CacheKey,
    CompilationResult,
    ExecutionOptionsWithEnv,
} from '../../types/compilation/compilation.interfaces.js';
import type {PreliminaryCompilerInfo} from '../../types/compiler.interfaces.js';
import {ExecutableExecutionOptions} from '../../types/execution/execution.interfaces.js';
import type {ParseFiltersAndOutputOptions} from '../../types/features/filters.interfaces.js';
import {assert} from '../assert.js';
import {SimpleOutputFilenameCompiler} from '../base-compiler.js';
import {CompilationEnvironment} from '../compilation-env.js';
import {BaseParser} from './argument-parsers.js';
import {JavaCompiler} from './java.js';

export class GroovyCompiler extends JavaCompiler implements SimpleOutputFilenameCompiler {
    static override get key() {
        return 'groovy';
    }

    javaHome: string;
    groovyHome: string;

    constructor(compilerInfo: PreliminaryCompilerInfo, env: CompilationEnvironment) {
        super(compilerInfo, env);
        // Groovy scripts and static mains show up in javap as either String[] or String...
        this.mainRegex = /public static ?(.*?) void main\(java\.lang\.String(\[]|\.\.\.)\)/;
        this.javaHome =
            this.compilerProps<string>(`compiler.${this.compiler.id}.java_home`) ||
            (this.javaRuntime ? path.dirname(path.dirname(this.javaRuntime)) : '');
        this.groovyHome =
            this.compilerProps<string>(`compiler.${this.compiler.id}.groovy_home`) ||
            (this.compiler.exe ? path.dirname(path.dirname(this.compiler.exe)) : '');
    }

    override getDefaultExecOptions() {
        const execOptions = super.getDefaultExecOptions();
        if (this.javaHome) {
            execOptions.env.JAVA_HOME = this.javaHome;
        }
        // groovyc is a JVM start-up for every compile; C1 only is noticeably faster for short runs
        execOptions.env.JAVA_OPTS = '-XX:TieredStopAtLevel=1 -Xshare:auto';
        return execOptions;
    }

    override async runCompiler(
        compiler: string,
        options: string[],
        inputFilename: string,
        execOptions: ExecutionOptionsWithEnv,
        filters?: ParseFiltersAndOutputOptions,
    ): Promise<CompilationResult> {
        if (!execOptions) {
            execOptions = this.getDefaultExecOptions();
        }
        if (!execOptions.customCwd) {
            execOptions.customCwd = path.dirname(inputFilename);
        }

        // Items before the source file are user options.
        const sourceFileOptionIndex = options.findIndex(option => option.endsWith('.groovy'));
        const userOptions = sourceFileOptionIndex === -1 ? options : options.slice(0, sourceFileOptionIndex);
        const groovyOptions = _.compact([
            ...this.getClasspathArgument(),
            '-d',
            path.dirname(inputFilename),
            ...userOptions,
            inputFilename,
        ]);
        const result = await this.exec(compiler, groovyOptions, execOptions);
        return {
            ...this.transformToCompilationResult(result, inputFilename),
            languageId: this.getCompilerResultLanguageId(filters),
            instructionSet: this.getInstructionSetFromCompilerArgs(options),
        };
    }

    override optionsForFilter(filters: ParseFiltersAndOutputOptions) {
        // Bytecode view is javap, as for Java and Kotlin
        filters.binary = true;
        return ['--encoding', 'utf8'];
    }

    override filterUserOptions(userOptions: string[]) {
        const oneArgForbiddenList = new Set([
            '-d', // output directory is ours
            '-s',
            '--sourcepath',
            '-sourcepath',
            '--source-path',
            '-cp', // classpath comes from the selected libraries
            '-classpath',
            '--classpath',
            '--configscript', // would let a user read arbitrary files on the host
            '--temp',
        ]);
        return this.filterUserOptionsWithArg(userOptions || [], oneArgForbiddenList);
    }

    override async handleInterpreting(
        key: CacheKey,
        executeParameters: ExecutableExecutionOptions,
    ): Promise<CompilationResult> {
        const executionPackageHash = this.env.getExecutableHash(key);
        const compileResult = await this.getOrBuildExecutable(key, BypassCache.None, executionPackageHash);
        if (compileResult.code !== 0) {
            return {
                stdout: compileResult.stdout,
                stderr: compileResult.stderr,
                code: compileResult.code,
                didExecute: false,
                buildResult: compileResult,
                timedOut: false,
            };
        }
        assert(compileResult.dirPath !== undefined);

        const classpath = [compileResult.dirPath, path.join(this.groovyHome, 'lib', '*')].join(path.delimiter);

        executeParameters.args = [
            '-XX:+IgnoreUnrecognizedVMOptions', // JDK 8 lacks some of the flags below
            '-Xss136K',
            '-XX:CICompilerCount=2',
            '-XX:-UseDynamicNumberOfCompilerThreads',
            '-XX:-UseDynamicNumberOfGCThreads',
            '-XX:+UseSerialGC',
            '-cp',
            classpath,
            await this.getMainClassName(compileResult.dirPath),
            ...executeParameters.args,
        ];
        const result = await this.runExecutable(this.javaRuntime, executeParameters, compileResult.dirPath);
        return {
            ...result,
            didExecute: true,
            buildResult: compileResult,
        };
    }

    override getArgumentParserClass() {
        // groovyc --help is not javac-shaped, so don't scrape it
        return BaseParser;
    }
}
