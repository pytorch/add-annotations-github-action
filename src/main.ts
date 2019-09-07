import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as octokit from '@octokit/rest';

const { GITHUB_TOKEN, GITHUB_WORKSPACE } = process.env;

type Annotation = octokit.ChecksUpdateParamsOutputAnnotations;
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
      const annotation_level = <const> 'failure';
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
  const res = await octokit.checks.listForRef({
    check_name,
    ...github.context.repo,
    ref: github.context.sha
  });

  const check_run_id = res.data.check_runs[0].id;

  await octokit.checks.update({
    ...github.context.repo,
    check_run_id,
    output: {
      title,
      summary: `${annotations.length} errors(s) found`,
      annotations
    }
  });
}

async function run() {
  try {
    const fileLocation = core.getInput('fileLocation');
    const output = await fs.promises.readFile(`${GITHUB_WORKSPACE}/${fileLocation}`);
    const regexp = core.getInput('regex');
    const annotations = parseOutput(output.toString(), RegExp(regexp));
    if (annotations.length > 0) {
      console.log(annotations);
      const checkName = core.getInput('checkName');
      await createCheck(checkName, "flake8 failure", annotations);
      core.setFailed(`${annotations.length} errors(s) found`);
    }
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run();
