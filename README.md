# add-annotations-github-action

A [GitHub Action][] to add [checks][] to pull requests by running lines of
output from a linter (such as [Flake8][] or [clang-tidy][]) through a regex.

## Example

```yml
on: pull_request
jobs:
  fake8:
    runs-on: ubuntu-latest
    steps:
      - run: |
          touch fake8.txt
          echo 'README.md:1:3: R100 make a better title' >> fake8.txt
          echo 'README.md:2:1: R200 give a better description' >> fake8.txt
      - uses: pytorch/add-annotations-github-action@master
        with:
          check_name: fake8
          linter_output_path: fake8.txt
          commit_sha: ${{ github.event.pull_request.head.sha }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Usage

See [action.yml][] for most of the usage info. Also note that (as shown in the
example above) `env.GITHUB_TOKEN` must be set, or this action will simply fail
with the message `Error: Bad credentials`.

[action.yml]: action.yml
[checks]: https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/about-status-checks#checks
[clang-tidy]: https://clang.llvm.org/extra/clang-tidy/
[flake8]: https://flake8.pycqa.org/en/latest/
[github action]: https://docs.github.com/en/actions/learn-github-actions/introduction-to-github-actions#actions
