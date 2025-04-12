import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";

import { fileURLToPath } from "node:url"
import * as path from "node:path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Target browsers, see: https://github.com/browserslist/browserslist
const targets = ["chrome >= 87", "edge >= 88", "firefox >= 78", "safari >= 14"];

export default defineConfig({
    resolve: {
        extensions: [".js", ".jsx", ".ts", ".tsx", ".json", ".wasm"],
    },	
    devServer: {
        port: '8084',
        hot: true,
    },
    devTool: "source-map",
    entry: {
        canvas: "./src/canvas/canvas.js",
        note: "./src/note/note.js",
    },
    module: {
        rules: [
            {
                test: /\.svg$/,
                type: "asset"
            },
            {
                test: /\.jsx?$/,
                use: [
                    {
                        loader: "builtin:swc-loader",
                        options: {
                            jsc: {
                                parser: {
                                    syntax: "ecmascript",
                                    jsx: true,
                                }
                            },
                            env: { targets }
                        }
                    }
                ]
            }
        ]
    },
    plugins: [
        new rspack.HtmlRspackPlugin({
            filename: "canvas.html",
            template: "src/canvas/canvas.html",
            chunks: ["canvas"],
        }),
        new rspack.HtmlRspackPlugin({
            filename: "note.html",
            template: "src/note/note.html",
            chunks: ["note"],
        }),
    ],
    optimization: {
        minimizer: [
            new rspack.SwcJsMinimizerRspackPlugin(),
            new rspack.LightningCssMinimizerRspackPlugin({
                minimizerOptions: { targets }
            })
        ]
    },
    experiments: {
        css: true
    }
});
