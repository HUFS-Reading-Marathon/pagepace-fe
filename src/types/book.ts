export type BookSearchResult = {
  libraryBookId: number;
  title: string;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  pageCount: number | null;
  callNo: string | null;
  libraries: string[];
  thumbnailUrl: string | null;
};
