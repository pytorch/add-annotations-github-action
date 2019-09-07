"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
// Regex match each line in the output and turn them into annotations
function parseOutput(output, regex) {
    let errors = output.split('\n');
    let annotations = [];
    for (let i = 0; i < errors.length; i++) {
        let error = errors[i];
        let match = error.match(regex);
        console.log(regex);
        console.log(error);
        console.log(match);
        if (match) {
            const groups = match.groups;
            if (!groups) {
                throw "No named capture groups in regex match.";
            }
            // Chop `./` off the front so that Github will recognize the file path
            const normalized_path = groups.filename.replace('./', '');
            const line = parseInt(groups.lineNumber);
            const column = parseInt(groups.columnNumber);
            const annotation_level = 'failure';
            const annotation = {
                path: normalized_path,
                start_line: line,
                end_line: line,
                start_column: column,
                end_column: column,
                annotation_level,
                message: `[${groups.errorCode}] ${groups.errorDesc}`,
            };
            console.log(annotation);
            annotations.push(annotation);
        }
    }
    return annotations;
}
function createCheck(check_name, title, annotations) {
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = new github.GitHub(String(GITHUB_TOKEN));
        const res = yield octokit.checks.listForRef(Object.assign(Object.assign({ check_name }, github.context.repo), { ref: github.context.sha }));
        const check_run_id = res.data.check_runs[0].id;
        yield octokit.checks.update(Object.assign(Object.assign({}, github.context.repo), { check_run_id, output: {
                title,
                summary: `${annotations.length} errors(s) found`,
                annotations
            } }));
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const fileLocation = core.getInput('fileLocation');
            const output = yield fs.promises.readFile(`${GITHUB_WORKSPACE}/${fileLocation}`);
            const regex = core.getInput('regex');
            const annotations = parseOutput(output.toString(), RegExp(regex));
            if (annotations.length > 0) {
                console.log(annotations);
                const checkName = core.getInput('checkName');
                yield createCheck(checkName, "flake8 failure", annotations);
                core.setFailed(`${annotations.length} errors(s) found`);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
