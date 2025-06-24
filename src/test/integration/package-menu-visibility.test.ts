import "reflect-metadata";
import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

suite("Package.json Menu Visibility Test Suite", () => {
  test("askAiWithPrompt menu item should have environment-aware when clause", () => {
    // Read package.json from the project root (go up from out/test/test to project root)
    const packageJsonPath = path.join(__dirname, "../../../package.json");
    assert.ok(fs.existsSync(packageJsonPath), "package.json should exist");

    const packageContent = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageContent);

    // Find the menu contribution for askAiWithPrompt
    const viewItemContextMenus =
      packageJson.contributes?.menus?.["view/item/context"];
    assert.ok(viewItemContextMenus, "view/item/context menu should exist");

    const askAiMenuItem = viewItemContextMenus.find(
      (menu: any) => menu.command === "promptManager.askAiWithPrompt"
    );

    assert.ok(askAiMenuItem, "askAiWithPrompt menu item should exist");

    // Verify the when clause includes environment awareness
    assert.match(askAiMenuItem.when, /promptManager\.isVSCode/, "Menu item should have environment-aware when clause");

    // Verify it's in the inline group
    assert.strictEqual(
      askAiMenuItem.group,
      "inline",
      "Menu item should be in inline group"
    );
  });

  test("package.json should have valid JSON structure", () => {
    const packageJsonPath = path.join(__dirname, "../../../package.json");
    const packageContent = fs.readFileSync(packageJsonPath, "utf8");

    // This will throw if JSON is invalid
    const packageJson = JSON.parse(packageContent);

    assert.ok(
      packageJson.contributes,
      "Package should have contributes section"
    );
    assert.ok(
      packageJson.contributes.menus,
      "Package should have menus section"
    );
  });
});
