"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const { GITHUB_TOKEN, GITHUB_WORKSPACE } = process.env;
function getAnnotationLevel() {
    let val = core.getInput('annotation_level');
    if (!val) {
        return 'failure';
    }
    else {
        return val;
    }
}
// Regex match each line in the output and turn them into annotations
function parseOutput(output, regex) {
    let errors = output.split('\n');
    let annotations = [];
    for (let i = 0; i < errors.length; i++) {
        let error = errors[i];
        let match = error.match(regex);
        if (match) {
            const groups = match.groups;
            if (!groups) {
                throw "No named capture groups in regex match.";
            }
            // Chop `./` off the front so that Github will recognize the file path
            const normalized_path = groups.filename.replace('./', '');
            const line = parseInt(groups.lineNumber);
            const column = parseInt(groups.columnNumber);
            const annotation_level = (getAnnotationLevel() == 'warning') ?
                'warning' :
                'failure';
            const annotation = {
                path: normalized_path,
                start_line: line,
                end_line: line,
                start_column: column,
                end_column: column,
                annotation_level: annotation_level,
                message: `[${groups.errorCode}] ${groups.errorDesc}`,
            };
            annotations.push(annotation);
        }
    }
    return annotations;
}
function createCheck(check_name, title, annotations) {
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = new github.GitHub(String(GITHUB_TOKEN));
        const req = Object.assign({}, github.context.repo, { ref: core.getInput('commit_sha') });
        console.log(req);
        const res = yield octokit.checks.listForRef(req);
        console.log(res);
        const check_run_id = res.data.check_runs.filter(check => check.name === check_name)[0].id;
        const update_req = Object.assign({}, github.context.repo, { check_run_id, output: {
                title,
                summary: `${annotations.length} errors(s) found`,
                annotations
            } });
        console.log(update_req);
        yield octokit.checks.update(update_req);
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const linterOutputPath = core.getInput('linter_output_path');
            console.log(`Reading linter output from: ${GITHUB_WORKSPACE}/${linterOutputPath}`);
            const output = yield fs.promises.readFile(`${GITHUB_WORKSPACE}/${linterOutputPath}`);
            const regex = core.getInput('regex');
            const annotations = parseOutput(output.toString(), RegExp(regex));
            if (annotations.length > 0) {
                console.log("===============================================================");
                console.log("| FAILURES DETECTED                                           |");
                console.log("|    You don't need to read this log output.                  |");
                console.log("|    Check the 'Files changed' tab for in-line annotations!   |");
                console.log("===============================================================");
                console.log(annotations);
                const checkName = core.getInput('check_name');
                yield createCheck(checkName, 'failures detected', annotations);
                console.log(`${annotations.length} errors(s) found`);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
