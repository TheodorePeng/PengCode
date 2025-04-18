// #popclip
// name: Paste Unformatted
// identifier: com.example.PasteUnformatted
// description: Paste unformatted text when there is no selected text.
// icon: symbol:text.cursor
// entitlements: [dynamic]
// popclipVersion: 4151

module.exports = {
	name: "Paste Unformatted",
	options: [{
	  identifier: "showIcon",
	  type: "boolean",
	  label: util.localize("Show as Icon"),
	  defaultValue: false,
	}],
	actions() {
	  if (popclip.context.canPaste && !popclip.context.text) {
		return {
		  icon: popclip.options.showIcon ? undefined : null,
		  code() {
			popclip.performCommand("paste", { unformatted: true });
		  },
		};
	  }
	},
  };