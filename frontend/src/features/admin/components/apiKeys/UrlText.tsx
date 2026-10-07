import { Fragment } from 'react'

/** A URL that may wrap after a slash but never inside a path segment ("…/pms/eve|nts"):
 *  it is a value the reader checks. The break points do not change what is copied. */
export default function UrlText({ url, className }: { url: string; className?: string }) {
  const parts = url.split(/(?<=\/)/)
  return (
    <code className={className}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <wbr />}
        </Fragment>
      ))}
    </code>
  )
}
