declare module "lucene-query-parser" {
  /**
   * Parse a Lucene query string
   * @param query The query string to parse
   * @returns Parsed query object
   * @throws SyntaxError if the query is malformed
   */
  function parseLucene(query: string): any;
  export default parseLucene;
}
