const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const gitIgnoreParser = require("gitignore-parser");

const rootDirectory = process.argv[2]; // Project's root directory
const functionToCheck = process.argv[3]; // Name of your function to search for
const shouldDisplayPretty = process.argv[4] === "-pretty"; // Display pretty output
const shouldDisplayJson = process.argv[4] === "-json"; // Display json output

if (!rootDirectory) {
  console.error("Please provide a root directory");
  process.exit(1);
}
if (!process.argv[2]) {
  console.log("Please provide a function name.");
  process.exit(1);
}

const gitignorePath = path.join(rootDirectory, ".gitignore");
const gitignoreContent = fs.existsSync(gitignorePath)
  ? fs.readFileSync(gitignorePath, "utf-8")
  : "";

const gitignore = gitIgnoreParser.compile(gitignoreContent);

// Ignores files in .gitignore
function shouldIgnore(filePath) {
  const relativePath = path
    .relative(rootDirectory, filePath)
    .replace(/\\/g, "/");
  return gitignore.denies(relativePath);
}

function parseFile(filePath) {
  const code = fs.readFileSync(filePath, "utf-8");
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const references = [];

  traverse(ast, {
    CallExpression(path) {
      if (path.node.callee.name === functionToCheck) {
        references.push({
          name: functionToCheck,
          location: path.node.loc,
          arg: path.node.arguments?.[0]?.value ?? null,
        });
      }
    },
  });

  return references;
}

function processFile(filePath) {
  if (shouldIgnore(filePath)) {
    return;
  }

  const references = parseFile(filePath);

  const locations = [];
  if (references.length > 0) {
    return {
      filePath,
      references,
    };
  }
}

function traverseDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  const output = [];
  files.forEach((file) => {
    const filePath = `${dirPath}/${file}`;
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!shouldIgnore(filePath)) {
        const results = traverseDirectory(filePath);
        output.push(...results);
      }
    } else if (
      stat.isFile() &&
      [".js", ".tsx"].some((ext) => filePath.endsWith(ext))
    ) {
      const result = processFile(filePath);
      if (result) {
        output.push(result);
      }
    }
  });
  return output;
}

function generateMermaidMarkdown(results) {
  let mermaidMarkdown = "";
  results.forEach((fileResult) => {
    mermaidMarkdown += `# Page: ${fileResult.filePath}\n\`\`\`mermaid\nsequenceDiagram\n`;
    const pageName = fileResult.filePath.split("/pages")[1];
    if (fileResult.references.length > 0) {
      fileResult.references.forEach((ref) => {
        mermaidMarkdown += `  ${pageName}->>"${getFileParticipantName(
          ref.arg
        )}": Fetch API call\n`;
        mermaidMarkdown += `  participant "${getFileParticipantName(
          ref.arg
        )}" as ${getEscapedParticipantName(ref.arg)}\n`;
      });
    }
    mermaidMarkdown += "```\n";
  });

  return mermaidMarkdown;
}
function getEscapedParticipantName(filePath) {
  return filePath.replace(/:/g, "&#58;"); // Mermaid uses ":", so we need to escape it
}
function getFileParticipantName(filePath) {
  return filePath.replace(/:/g, "_");
}

const output = traverseDirectory(rootDirectory);

if (shouldDisplayPretty) {
  output.forEach((fileResult) => {
    console.log(`File: ${fileResult.filePath}`);
    fileResult.references.forEach((ref) => {
      const { start, end } = ref.location;
      console.log(
        `- Reference to function '${functionToCheck}' at Line ${start.line}, Column ${start.column}`
      );
      console.log(`  Argument: ${ref.arg}`);
    });
  });
} else if (shouldDisplayJson) {
  const nonEmptyOutput = output.filter(
    (fileResult) => fileResult.references.length > 0
  );
  console.log(JSON.stringify(nonEmptyOutput, null, 2));
} else {
  const mermaidMarkdown = generateMermaidMarkdown(output);
  fs.writeFileSync("code_structure.mermaid.md", mermaidMarkdown, "utf-8");
}
