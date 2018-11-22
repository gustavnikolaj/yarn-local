# yarn-local

Helper scripts for managing yarn when checked into repositories.

## Why use a checked-in version of yarn

Excerpt from the yarn docs:

> ```
> yarn-path "./bin/yarn"
> ```
>
> Instructs yarn to defer to another Yarn binary for execution. Useful if you
> want to bundle Yarn into your repository and have everyone use the same
> version for consistency. This was introduced in Yarn 1.0, so all developers
> must have Yarn = 1.0 installed.

## Why yarn-local

This script will when you first invoke it in a repository without a locally
installed yarn:

1. Setup the necessary configuration in .yarnrc
2. Download the latest version of yarn and save it to a file in your repo.

On subsequent invocations it will just check if there is a newer version of yarn
than the one you have checked in, and if so, do the necessary update including
downloading the new version of yarn.

## Installation

```
$ npm i -g @gustavnikolaj/yarn-local
$ yarn global add @gustavnikolaj/yarn-local
```

Or you can just invoke the binary with [npx](https://www.npmjs.com/package/npx).
The benefit of doing this is that you don't have to install the package
globally.

```
$ npx yarn-local
```

## Usage

Given that this is a single purpose script and that we can tell what needs to be
done by just looking at the current repository, there is no arguments to pass.
Just invoke the script in the right directory.

```
$ yarn-local
```

Or if using npx:

```
$ npx yarn-local
```
