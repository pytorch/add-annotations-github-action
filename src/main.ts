import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as octokit from '@octokit/rest';

const { GITHUB_TOKEN, GITHUB_WORKSPACE } = process.env;

type Annotation = octokit.ChecksUpdateParamsOutputAnnotations;

function getAnnotationLevel(): string {
    let val: string = core.getInput('annotation_level');
    console.log("annotation_level = " + val);
    if (!val) {
        return <const>'failure';
    } else {
        return val;
    }
}

// Regex match each line in the output and turn them into annotations
function parseOutput(output: string, regex: RegExp): Annotation[] {
  let errors = output.split('\n');
  let annotations: Annotation[] = [];
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
      const annotation_level = getAnnotationLevel();
      const annotation = {
        path: normalized_path,
        start_line: line,
        end_line: line,
        start_column: column,
        end_column: column,
        annotation_level,
        message: `[${groups.errorCode}] ${groups.errorDesc}`,
      };

      annotations.push(annotation);
    }
  }
  return annotations;
}

async function createCheck(check_name: string, title: string, annotations: Annotation[]) {
  const octokit = new github.GitHub(String(GITHUB_TOKEN));
  const req = {
    ...github.context.repo,
    ref: core.getInput('commit_sha')
  }
  console.log(req)
  const res = await octokit.checks.listForRef(req);
  console.log(res)

  const check_run_id = res.data.check_runs.filter(check => check.name === check_name)[0].id

  const update_req = {
    ...github.context.repo,
    check_run_id,
    output: {
      title,
      summary: `${annotations.length} errors(s) found`,
      annotations
    }
  }

  console.log(update_req)
  await octokit.checks.update(update_req);
}

async function run() {
  try {
    const linterOutputPath = core.getInput('linter_output_path');
    console.log(`Reading linter output from: ${GITHUB_WORKSPACE}/${linterOutputPath}`)
    const output = await fs.promises.readFile(`${GITHUB_WORKSPACE}/${linterOutputPath}`);
    const regex = core.getInput('regex');
    const annotations = parseOutput(output.toString(), RegExp(regex));
    if (annotations.length > 0) {
      console.log("===============================================================")
      console.log("| FAILURES DETECTED                                           |")
      console.log("|    You don't need to read this log output.                  |")
      console.log("|    Check the 'Files changed' tab for in-line annotations!   |")
      console.log("===============================================================")

      console.log(annotations);
      const checkName = core.getInput('check_name');
      await createCheck(checkName, 'failures detected', annotations);
      const annotation_level = getAnnotationLevel();
      if (annotation_level != 'warning') {
        core.setFailed(`${annotations.length} errors(s) found`);
      }
    }
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run();
