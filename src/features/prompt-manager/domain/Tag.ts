/**
 * Tag value object - represents a tag used to categorize prompts
 * Tags are stored in lowercase for consistency
 */
export class Tag {
  private readonly _value: string;

  constructor(value: string) {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
      throw new Error("Tag cannot be empty");
    }
    if (normalizedValue.length > 50) {
      throw new Error("Tag is too long (max 50 characters)");
    }
    this._value = normalizedValue;
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: Tag): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }

  /**
   * Create a Tag from a string, handling normalization
   */
  public static from(value: string): Tag {
    return new Tag(value);
  }

  /**
   * Create multiple tags from an array of strings
   */
  public static fromArray(values: string[]): Tag[] {
    return values
      .filter((value) => value && value.trim())
      .map((value) => Tag.from(value));
  }
}
