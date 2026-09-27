import AnimatedNumber from './AnimatedNumber'
import { investorColor } from '../colors'
import { money } from '../format'
import { gatheringReason } from './gatheringCopy'

function Name({ children }) {
  return (
    <span className="font-semibold" style={{ color: investorColor(children) }}>
      {children}
    </span>
  )
}

function Stack({ title, names }) {
  return (
    <div>
      <div className="kicker mb-1 text-mute">{title}</div>
      {names.length === 0 ? (
        <p className="text-mute">No one</p>
      ) : (
        <ul className="space-y-1">
          {names.map((name) => (
            <li key={name}>
              <Name>{name}</Name>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Floor({ gathering }) {
  const buyers = gathering?.crowd.filter((p) => p.stance === 'buying').map((p) => p.name) ?? []
  const sellers = gathering?.crowd.filter((p) => p.stance === 'selling').map((p) => p.name) ?? []
  const dropped = gathering?.trigger
  const dim = dropped && dropped.kind !== 'entered' && !buyers.includes(dropped.name) && !sellers.includes(dropped.name)
    ? dropped.name
    : null

  return (
    <section className="panel animate-fade-up">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="panel-title">The floor</h2>
        {gathering && <span className="text-mute">Turn {gathering.tick}</span>}
      </div>

      {!gathering ? (
        <p className="sentence text-mute">The square is quiet.</p>
      ) : (
        <>
          <p className="text-[20px] leading-[1.2] font-semibold">
            {gathering.open_cents === gathering.close_cents ? (
              <AnimatedNumber
                value={gathering.close_cents}
                format={money}
                duration={200}
                className="text-text"
              />
            ) : (
              <>
                <span className="text-dim">{money(gathering.open_cents)}</span>
                {' '}
                <span className="mx-2 font-normal text-mute">to</span>
                {' '}
                <AnimatedNumber
                  value={gathering.close_cents}
                  format={money}
                  duration={200}
                  className="text-text"
                />
              </>
            )}
          </p>
          <p className="sentence mt-1 mb-4 text-dim">{gatheringReason(gathering)}</p>
          <div className="grid grid-cols-2 gap-4">
            <Stack title="Buying" names={buyers} />
            <Stack title="Selling" names={sellers} />
          </div>
          {dim && <p className="mt-3 text-mute">{dim}</p>}
          <ul className="mt-4 space-y-1">
            {gathering.trades.length === 0 ? (
              <li className="text-mute">No sale</li>
            ) : (
              gathering.trades.map((trade) => (
                <li key={`${trade.buyer}-${trade.seller}`}>
                  <Name>{trade.buyer}</Name> buys {trade.quantity} from <Name>{trade.seller}</Name> @{' '}
                  {money(trade.price_cents)}
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </section>
  )
}
