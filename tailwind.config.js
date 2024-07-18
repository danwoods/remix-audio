module.exports = {
  content: ["./app/**/*.tsx"],
  plugins: [require("daisyui")],
  daisyui: {
    themes: true,
    darkTheme: "black",
    base: true, // applies background color and foreground color for root element by default
    styled: true, // include daisyUI colors and design decisions for all components
    utils: true, // adds responsive and modifier utility classes
    prefix: "", // prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
    logs: true, // Shows info about daisyUI version and used config in the console when building your CSS
    themeRoot: ":root",
  },
};
