import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";

// Target browsers, see: https://github.com/browserslist/browserslist
const targets = ["chrome >= 87", "edge >= 88", "firefox >= 78", "safari >= 14"];

export default defineConfig({
	resolve: {
		extensions: [".js", ".jsx", ".ts", ".tsx", ".json", ".wasm"]
	},	
	devServer: {
		port: '8084',
	},
	devTool: "source-map",
	entry: {
		main: "./src/index.js"
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
	plugins: [new rspack.HtmlRspackPlugin({ template: "./index.html" })],
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
